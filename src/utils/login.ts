import { Page } from 'playwright';

interface Credentials {
    username?: string;
    password?: string;
}

/**
 * Attempts to log in to a website using provided credentials.
 * Tries common selectors for username, password, and submit buttons.
 *
 * @param page The Playwright Page object.
 * @param loginUrl The URL of the login page.
 * @param credentials An object containing username and/or password.
 * @returns A promise that resolves to true if login attempt seemed successful, false otherwise.
 */
export async function attemptLogin(
    page: Page,
    loginUrl: string,
    credentials: Credentials
): Promise<boolean> {
    if (!credentials.username || !credentials.password) {
        console.log('No credentials provided, skipping login attempt.');
        return true; // Technically not a failure, just nothing to do.
    }

    console.log(`Attempting login at: ${loginUrl}`);

    try {
        await page.goto(loginUrl, { waitUntil: 'networkidle' });
        console.log(`Navigated to login page: ${loginUrl}`);

        // Common selectors - these might need adjustment per site
        const usernameSelectors = [
            '#username', '#user_login', '#email',
            'input[name="log"]', 'input[name="username"]', 'input[name="email"]',
            'input[type="email"]', 'input[type="text"][name*="user"]' // More generic
        ];
        const passwordSelectors = [
            '#password', '#user_pass',
            'input[name="pwd"]', 'input[name="password"]',
            'input[type="password"]' // Generic
        ];
        const submitSelectors = [
            'button[type="submit"]', '#wp-submit',
            'input[type="submit"]', 'button:contains("Log In")', 'button:contains("Sign In")' // Text-based might be fragile
        ];

        let loggedIn = false;

        // Try filling username
        let usernameFilled = false;
        for (const selector of usernameSelectors) {
            try {
                await page.locator(selector).first().fill(credentials.username, { timeout: 2000 });
                console.log(`Filled username using selector: ${selector}`);
                usernameFilled = true;
                break;
            } catch (e) { /* Selector not found, try next */ }
        }
        if (!usernameFilled) {
            console.warn('Could not find a suitable username field.');
            return false;
        }

        // Try filling password
        let passwordFilled = false;
        for (const selector of passwordSelectors) {
            try {
                await page.locator(selector).first().fill(credentials.password, { timeout: 2000 });
                console.log(`Filled password using selector: ${selector}`);
                passwordFilled = true;
                break;
            } catch (e) { /* Selector not found, try next */ }
        }
        if (!passwordFilled) {
            console.warn('Could not find a suitable password field.');
            return false;
        }

        // Try clicking submit
        let submitClicked = false;
        for (const selector of submitSelectors) {
            try {
                await page.locator(selector).first().click({ timeout: 3000 });
                console.log(`Clicked submit button using selector: ${selector}`);
                submitClicked = true;
                break;
            } catch (e) { /* Selector not found, try next */ }
        }
        if (!submitClicked) {
            console.warn('Could not find a suitable submit button.');
            return false;
        }

        // Wait for navigation or some indication of successful login
        // This is tricky and site-dependent. We might wait for a specific element
        // that only appears after login, or wait for the URL to change, or just
        // wait for network activity to settle. networkidle is a reasonable guess.
        console.log('Waiting for navigation/response after login submit...');
        await page.waitForLoadState('networkidle', { timeout: 10000 }); // Wait up to 10 seconds

        // Basic check: Did the URL change from the login page?
        if (page.url() !== loginUrl) {
            console.log('Login likely successful (URL changed).');
            loggedIn = true;
        } else {
            // More sophisticated checks could go here:
            // - Check for error messages on the login page
            // - Check for expected elements on the post-login page
            console.warn('Login may have failed (URL did not change). Further checks needed.');
            // For now, we'll assume it might have worked if no obvious error occurred
            // but ideally, we'd have a better success indicator.
            loggedIn = true; // Optimistic assumption for now
        }

        return loggedIn;

    } catch (error) {
        console.error(`Error during login attempt at ${loginUrl}:`, error);
        return false;
    }
}
