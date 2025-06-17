import express, { Request, Response } from 'express';

const router = express.Router();

// Define the list of supported platforms
// This should be the single source of truth for platform identifiers and display names
const SUPPORTED_PLATFORMS = [
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'YOUTUBE_SHORTS', label: 'YouTube Shorts' }
];

/**
 * @swagger
 * /api/v1/platforms:
 *   get:
 *     summary: Retrieve the list of supported platforms
 *     tags: [Platforms]
 *     responses:
 *       200:
 *         description: A list of supported platforms with their values and labels.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   value:
 *                     type: string
 *                     description: The internal identifier for the platform.
 *                     example: YOUTUBE_SHORTS
 *                   label:
 *                     type: string
 *                     description: The display name for the platform.
 *                     example: YouTube Shorts
 */
router.get('/', (req: Request, res: Response) => {
  try {
    // Simply return the hardcoded list for now
    // In the future, this could potentially fetch from a config or database table
    res.status(200).json(SUPPORTED_PLATFORMS);
  } catch (error) {
    console.error("Error fetching platforms:", error);
    res.status(500).json({ message: "Error fetching platform list" });
  }
});

export default router;
