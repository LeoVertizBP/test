import { Router, Response, NextFunction } from 'express'; // Removed Request import as AuthenticatedRequest is used
import * as ruleSetService from '../services/ruleSetService';
import * as advertiserService from '../services/advertiserService'; // Need this for auth checks
import { authenticateToken, AuthenticatedRequest, DecodedPayload } from '../middleware/authMiddleware'; // Import AuthenticatedRequest and DecodedPayload
// import * as jwt from 'jsonwebtoken'; // No longer needed here if DecodedPayload is imported
import asyncHandler from '../utils/asyncHandler';

// DecodedPayload is now imported from middleware

const router = Router();

// Apply authentication middleware to all rule set routes
router.use(authenticateToken);

// --- Routes for Rule Sets ---

// GET /api/rule-sets - Retrieve rule sets (filtered by advertiser or all for org)
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const advertiserId = req.query.advertiserId as string | undefined;
    const userPayload = req.user; // Get user payload

    if (!userPayload?.organizationId) {
        return res.status(403).json({ message: 'Forbidden: Organization ID missing from token.' });
    }
    const userOrganizationId = userPayload.organizationId;

    let ruleSets: any[] = []; // Use specific RuleSet type later

    if (advertiserId) {
        // Fetching for a specific advertiser - verify user org matches advertiser org
        const advertiser = await advertiserService.getAdvertiserById(advertiserId);
        if (!advertiser) {
             return res.status(404).json({ message: 'Advertiser not found.' });
        }
        if (advertiser.organization_id !== userOrganizationId /* && userPayload.role !== 'ADMIN' */) {
             return res.status(403).json({ message: 'Forbidden: Access denied to this advertiser\'s rule sets.' });
        }
        // If authorized, get rule sets for this specific advertiser
        ruleSets = await ruleSetService.getRuleSetsByAdvertiserId(advertiserId);
    } else {
        // No specific advertiser requested, get all rule sets for the user's organization
        // We need to add getRuleSetsByOrganizationId to the service and repository
        ruleSets = await ruleSetService.getRuleSetsByOrganizationId(userOrganizationId);
    }

    res.status(200).json(ruleSets);
}));

// GET /api/rule-sets/:id - Retrieve a single rule set by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const userPayload = req.user; // Get user payload
    console.log(`[RuleSet Route] GET /:id - Received request for ID: ${id}`); // Log received ID

    // Add authorization check (user belongs to rule set's advertiser's org or is admin)
    const ruleSet = await ruleSetService.getRuleSetById(id); // Fetch rule set
    console.log(`[RuleSet Route] GET /:id - Fetched ruleSet:`, ruleSet ? ruleSet.id : 'null'); // Log result of fetch

    if (!ruleSet) {
        console.log(`[RuleSet Route] GET /:id - Rule set ${id} not found in DB.`);
        return res.status(404).json({ message: 'Rule set not found.' });
    }

    // Authorization check
    console.log(`[RuleSet Route] GET /:id - Checking authorization for user org ${userPayload?.organizationId} against advertiser ${ruleSet.advertiser_id}`);
    const advertiser = await advertiserService.getAdvertiserById(ruleSet.advertiser_id);
    console.log(`[RuleSet Route] GET /:id - Fetched advertiser for auth check:`, advertiser ? advertiser.id : 'null'); // Log advertiser fetch result

     if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
         console.log(`[RuleSet Route] GET /:id - Authorization failed. User Org: ${userPayload?.organizationId}, Advertiser Org: ${advertiser?.organization_id}`);
         return res.status(403).json({ message: 'Forbidden: Access denied to this rule set.' });
    }
    console.log(`[RuleSet Route] GET /:id - Authorization passed.`);

    res.status(200).json(ruleSet);
}));

// POST /api/rule-sets - Create a new rule set
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { name, set_type, description, is_default, advertiser_id } = req.body; // Use advertiser_id directly
    const userPayload = req.user; // Get user payload

    if (!name || !set_type || !advertiser_id) {
        return res.status(400).json({ message: 'Missing required fields: name, set_type, advertiser_id' });
    }
    // TODO: Validate set_type against an enum or list if possible
    // if (set_type !== 'product' && set_type !== 'channel' && set_type !== 'global') {
    //      return res.status(400).json({ message: "Invalid set_type. Must be 'product', 'channel', or 'global'." });
    // }

    // Authorization check: Ensure user belongs to the advertiser's organization
    const advertiser = await advertiserService.getAdvertiserById(advertiser_id);
     if (!advertiser) {
        return res.status(404).json({ message: 'Advertiser not found for rule set creation.' });
    }
    if (!userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
         return res.status(403).json({ message: 'Forbidden: Cannot create rule set for this advertiser.' });
    }

    const ruleSetData = { name, set_type, description, is_default, advertiser_id };

    const newRuleSet = await ruleSetService.createRuleSet(ruleSetData);
    res.status(201).json(newRuleSet);
}));

// PUT /api/rule-sets/:id - Update an existing rule set
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const updateData = req.body;
    const userPayload = req.user; // Get user payload
    if (Object.keys(updateData).length === 0) {
       return res.status(400).json({ message: 'No update data provided.' });
    }
    // Prevent changing advertiser or set_type
    delete updateData.advertiserId;
    delete updateData.advertiser_id;
    delete updateData.set_type;

    // Authorization check: Ensure user is authorized for rule set's advertiser
    // First, get the rule set to check ownership/authorization
    const ruleSet = await ruleSetService.getRuleSetById(id);
    
    if (!ruleSet) {
        return res.status(404).json({ message: 'Rule set not found.' });
    }

    // Check authorization based on advertiser's organization
    const advertiser = await advertiserService.getAdvertiserById(ruleSet.advertiser_id);
     if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
         return res.status(403).json({ message: 'Forbidden: Cannot update this rule set.' });
    }

    // If authorized, proceed with update
    try {
        const updatedRuleSet = await ruleSetService.updateRuleSet(id, updateData);
        res.status(200).json(updatedRuleSet);
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Rule set not found during update.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

// DELETE /api/rule-sets/:id - Delete a rule set
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const userPayload = req.user; // Get user payload

    // Authorization check: Ensure user is authorized for rule set's advertiser
    // First, get the rule set to check ownership/authorization
    const ruleSet = await ruleSetService.getRuleSetById(id);
    
    if (!ruleSet) {
        return res.status(404).json({ message: 'Rule set not found.' });
    }

    // Check authorization based on advertiser's organization
    const advertiser = await advertiserService.getAdvertiserById(ruleSet.advertiser_id);
     if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
         return res.status(403).json({ message: 'Forbidden: Cannot delete this rule set.' });
    }

    // If authorized, proceed with delete
    try {
        await ruleSetService.deleteRuleSet(id);
        res.status(204).send();
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Rule set not found during delete.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

// --- Routes for Managing Rules within a Rule Set ---

// POST /api/rule-sets/:ruleSetId/rules - Add a rule to a rule set
router.post('/:ruleSetId/rules', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { ruleSetId } = req.params;
    const { ruleId } = req.body;
    const userPayload = req.user; // Get user payload

    if (!ruleId) {
        return res.status(400).json({ message: 'Missing required field: ruleId' });
    }

    // Authorization check: Ensure user is authorized for the rule set's advertiser
    const ruleSet = await ruleSetService.getRuleSetById(ruleSetId);
    if (!ruleSet) {
        return res.status(404).json({ message: 'Rule set not found.' });
    }
    const advertiser = await advertiserService.getAdvertiserById(ruleSet.advertiser_id);
     if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
         return res.status(403).json({ message: 'Forbidden: Cannot modify this rule set.' });
    }
    // TODO: Potentially add check if ruleId is valid/accessible too

    const mapping = await ruleSetService.addRuleToRuleSet(ruleSetId, ruleId);
    res.status(201).json(mapping); // Return the mapping entry
}));

// DELETE /api/rule-sets/:ruleSetId/rules/:ruleId - Remove a rule from a rule set
router.delete('/:ruleSetId/rules/:ruleId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { ruleSetId, ruleId } = req.params;
    const userPayload = req.user; // Get user payload

    // Authorization check: Ensure user is authorized for the rule set's advertiser
    const ruleSet = await ruleSetService.getRuleSetById(ruleSetId);
    // If rule set doesn't exist, we can't verify auth, but deletion attempt will fail anyway or return 0 count
    if (ruleSet) {
        const advertiser = await advertiserService.getAdvertiserById(ruleSet.advertiser_id);
         if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
             return res.status(403).json({ message: 'Forbidden: Cannot modify this rule set.' });
        }
    }

    const result = await ruleSetService.removeRuleFromRuleSet(ruleSetId, ruleId);
    
    if (result.count === 0) {
        // This could mean the rule wasn't in the set, or the set didn't exist
        // Consider fetching the rule set first for a more specific error message
        return res.status(404).json({ message: 'Rule or Rule Set not found, or rule not associated with this set.' });
    }
    
    res.status(204).send(); // Success, no content
}));


export default router;
