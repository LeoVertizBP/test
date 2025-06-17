# Finding CSS Selectors for Image Extraction

To help the website scanner accurately capture only the images you need (like hero images and images within article content), you can provide specific **CSS Selectors** in the channel configuration. This guide explains how to find these selectors using your web browser's built-in Developer Tools.

## What are CSS Selectors?

Think of them as addresses for specific elements on a webpage. Websites use HTML code to structure content, and CSS (Cascading Style Sheets) to style it. Selectors are patterns that target specific HTML elements based on their tags, IDs (`id="..."`), or classes (`class="..."`).

*   **ID Selector:** Starts with `#` (e.g., `#main-image`). IDs should be unique on a page.
*   **Class Selector:** Starts with `.` (e.g., `.article-content`). Multiple elements can share the same class.
*   **Tag Selector:** Uses the HTML tag name (e.g., `img` for images, `div` for containers).
*   **Combined Selectors:** You can combine selectors to be more specific (e.g., `.article-body img` targets only `img` elements *inside* an element with the class `article-body`).

## How to Find Selectors (Using Chrome - Other Browsers are Similar)

You'll use the "Inspect" tool to look at the website's underlying HTML structure.

**1. Open the Target Webpage:**
Navigate to a typical article or page on the website you want to configure.

**2. Open Developer Tools:**
Right-click anywhere on the page and select **"Inspect"** or **"Inspect Element"** from the context menu. Alternatively, you can usually press the `F12` key. This will open a panel (often at the bottom or side of your browser window) showing the page's HTML code.

**3. Find the Hero Image Selector:**
    *   **Right-click directly on the main hero image** (usually the large image at the top of the article).
    *   Select **"Inspect"** from the menu that appears.
    *   The Developer Tools panel will jump to and highlight the HTML code for that specific image (it will likely start with `<img ...`).
    *   **Look at the highlighted `<img>` tag and its "parent" elements** (the tags enclosing it). Look for unique or descriptive `id` or `class` attributes on the `<img>` tag itself or its immediate containers (like `<div>` or `<figure>`).
    *   **Examples:**
        *   If you see `<img id="main-article-image" src="...">`, a good selector is `#main-article-image`.
        *   If you see `<div class="hero-image-wrapper"> <img src="..."> </div>`, a good selector might be `.hero-image-wrapper img`.
        *   If the image itself has a class like `<img class="featured-image" src="...">`, you could use `.featured-image`.
    *   **Goal:** Find the most specific, stable selector that uniquely identifies the hero image(s).

**4. Find the Article Content Selector:**
    *   **Right-click somewhere within the main body of the article text** (not a heading or sidebar).
    *   Select **"Inspect"**.
    *   The Developer Tools will highlight the HTML element you clicked on (e.g., a `<p>` tag for a paragraph).
    *   **Look "up" the HTML structure** in the Developer Tools panel from the highlighted element. You are looking for the main container element that wraps *all* the article text and the images embedded *within* that text.
    *   Look for `id` or `class` attributes on these parent `<div>`, `<article>`, or `<section>` elements that seem descriptive.
    *   **Examples:**
        *   You might find `<div id="article-body"> ... all article content ... </div>`. The selector would be `#article-body`.
        *   You might see `<article class="post-content entry-content"> ... </article>`. Good selectors could be `.post-content` or `.entry-content`.
    *   **Goal:** Find the selector for the *container* that holds the main article content. The scanner will then look for `<img>` tags *inside* this container.

**5. Test Your Selectors (Optional but Recommended):**
    *   In the Developer Tools, find the **"Console"** tab.
    *   Type `document.querySelectorAll('YOUR_SELECTOR_HERE')` (replace `YOUR_SELECTOR_HERE` with the selector you found, keeping the quotes).
    *   Press Enter.
    *   The console will show you how many elements match your selector. If it's `0`, your selector is wrong or too specific. If it's more than expected (e.g., for a hero image), it might be too general. Expand the result (often a small triangle) to see exactly which elements were found.
    *   **Example Test:** `document.querySelectorAll('.article-body img')` should list all images found within the element having the class `article-body`.

**6. Enter Selectors in the Configuration:**
    *   Once you've found selectors you're confident in, copy them.
    *   Go to the Publisher Channel configuration in the Credit Compliance Tool UI.
    *   Paste the selector into the corresponding field ("Hero Image Selector" or "Article Content Selector").

**Tips:**

*   **Be Specific but Not Too Specific:** Avoid selectors that rely on automatically generated classes or IDs that might change (e.g., `class="post-12345"`). Look for semantic names like `article`, `content`, `hero`, `featured`.
*   **Classes vs. IDs:** IDs (`#`) are generally more specific than classes (`.`). Use IDs if available and relevant.
*   **Check Multiple Pages:** If a website's structure varies slightly between articles, check a few different pages to find a selector that works consistently.
*   **Trial and Error:** Finding the perfect selector might take a couple of tries. Use the Console test to verify.

By providing these selectors, you'll help the tool focus its image capture efforts effectively.
