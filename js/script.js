// --------------------------------------------------------------
// CONFIGURATION – EDIT THESE TWO VARIABLES FOR YOUR GITHUB REPO
// --------------------------------------------------------------
const GITHUB_USERNAME = "nourelhoudadaloua";      // ← change to your GitHub username
const REPO_NAME = "my-website";            // ← change to your repository name

// Categories (you can edit these freely)
const CATEGORIES = [
    { id: "cat1", displayName: "Category 1", subtitle: "Culture & Society", description: "Essays on art, identity, and public life", folder: "culture" },
    { id: "cat2", displayName: "Category 2", subtitle: "Technology & Progress", description: "Digital frontiers, ethics & modern tools", folder: "tech" },
    { id: "cat3", displayName: "Category 3", subtitle: "Personal Reflections", description: "Memory, daily rituals, and inner landscapes", folder: "personal" }
];

// Global state
let currentCategoryId = null;
let currentEssaysList = []; // stores { id, title, path, folder }

// DOM elements
const homeView = document.getElementById('homeView');
const categoriesViewDiv = document.getElementById('categoriesView');
const essayListViewDiv = document.getElementById('essayListView');
const essayReaderViewDiv = document.getElementById('essayReaderView');
const aboutViewDiv = document.getElementById('aboutView');
const newsletterViewDiv = document.getElementById('newsletterView');
const personalLinksViewDiv = document.getElementById('personalLinksView');

// Helper: hide all views
function hideAllViews() {
    const views = [homeView, categoriesViewDiv, essayListViewDiv, essayReaderViewDiv, aboutViewDiv, newsletterViewDiv, personalLinksViewDiv];
    views.forEach(v => v.classList.add('hidden'));
}

function showHome() {
    hideAllViews();
    homeView.classList.remove('hidden');
}

// --------------------------------------------------------------
// 1. FETCH LIST OF .MD FILES FROM A GITHUB FOLDER
// --------------------------------------------------------------
async function fetchMarkdownFilesFromFolder(folderName) {
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/essays/${folderName}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return []; // folder empty or doesn't exist
            throw new Error(`HTTP ${response.status}`);
        }
        const files = await response.json();
        // Filter only .md files
        const mdFiles = files.filter(file => file.name.endsWith('.md'));
        // For each file, extract title from the raw content (we'll fetch later)
        // But to avoid multiple API calls, we return basic info and will fetch title on demand.
        // However, we need titles for the essay list. We'll fetch each file's content to extract the first # heading.
        // To keep things simple and fast, we'll fetch titles in parallel.
        const essaysWithTitles = await Promise.all(mdFiles.map(async (file) => {
            const contentResp = await fetch(file.download_url);
            const markdown = await contentResp.text();
            // Extract title from first # heading
            const titleMatch = markdown.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1].trim() : file.name.replace(/\.md$/, '');
            // Extract excerpt (first line after title)
            let excerpt = '';
            const excerptMatch = markdown.match(/#.+\n\n(.+?)(\n\n|$)/s);
            if (excerptMatch) {
                excerpt = excerptMatch[1].replace(/\n/g, ' ').substring(0, 140);
                if (excerpt.length === 140) excerpt += '...';
            } else {
                excerpt = 'Read this essay →';
            }
            return {
                id: `${folderName}_${file.name.replace(/\.md$/, '')}`,
                title: title,
                path: file.path,
                download_url: file.download_url,
                folder: folderName,
                excerpt: excerpt
            };
        }));
        return essaysWithTitles;
    } catch (err) {
        console.error(`Error fetching ${folderName}:`, err);
        return [];
    }
}

// --------------------------------------------------------------
// 2. CATEGORIES VIEW (3 cards)
// --------------------------------------------------------------
function renderCategories() {
    categoriesViewDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 1rem;">
            <button class="back-nav" id="backToHomeFromCat">← Back to home</button>
        </div>
        <div class="categories-grid">
            ${CATEGORIES.map(cat => `
                <div class="category-card" data-category-id="${cat.id}" data-folder="${cat.folder}">
                    <h3>${escapeHtml(cat.displayName)}</h3>
                    <p>${escapeHtml(cat.subtitle)}</p>
                    <small>${escapeHtml(cat.description)}</small>
                </div>
            `).join('')}
        </div>
    `;
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', async () => {
            const folder = card.getAttribute('data-folder');
            const catId = card.getAttribute('data-category-id');
            await showEssayListForCategory(catId, folder);
        });
    });
    document.getElementById('backToHomeFromCat')?.addEventListener('click', showHome);
}

async function showCategoriesView() {
    renderCategories();
    hideAllViews();
    categoriesViewDiv.classList.remove('hidden');
}

// --------------------------------------------------------------
// 3. ESSAY LIST FOR A CATEGORY (fetches from GitHub on demand)
// --------------------------------------------------------------
async function showEssayListForCategory(categoryId, folderName) {
    currentCategoryId = categoryId;
    const category = CATEGORIES.find(c => c.id === categoryId);
    
    // Show loading indicator
    essayListViewDiv.innerHTML = `<div style="text-align:center; padding:3rem;">Loading essays from GitHub...</div>`;
    hideAllViews();
    essayListViewDiv.classList.remove('hidden');
    
    // Fetch essays from GitHub
    const essays = await fetchMarkdownFilesFromFolder(folderName);
    currentEssaysList = essays;
    
    if (essays.length === 0) {
        essayListViewDiv.innerHTML = `
            <div style="text-align:center; padding:3rem;">
                <button class="back-nav" id="backToCategoriesEmpty">← Back to categories</button>
                <p style="margin-top:2rem;">No essays in this category yet. Add a .md file to the <strong>essays/${folderName}/</strong> folder in your GitHub repo.</p>
            </div>`;
        document.getElementById('backToCategoriesEmpty')?.addEventListener('click', showCategoriesView);
        return;
    }
    
    let html = `<div style="max-width:720px; margin:0 auto;">
        <button class="back-nav" id="backToCategoriesFromList">← Back to categories</button>
        <h2 style="font-weight:450;">${escapeHtml(category.displayName)}</h2>
        <p style="color:#776c60;">${escapeHtml(category.description)}</p>
        <div class="essay-list">`;
    essays.forEach(essay => {
        html += `<div class="essay-item" data-essay-id="${essay.id}" data-download-url="${essay.download_url}" data-folder="${essay.folder}" data-path="${essay.path}">
                    <div class="essay-title">${escapeHtml(essay.title)}</div>
                    <div class="essay-meta">${escapeHtml(essay.excerpt)}</div>
                </div>`;
    });
    html += `</div></div>`;
    essayListViewDiv.innerHTML = html;
    
    // Attach click handlers
    document.querySelectorAll('.essay-item').forEach(item => {
        item.addEventListener('click', () => {
            const downloadUrl = item.getAttribute('data-download-url');
            const essayId = item.getAttribute('data-essay-id');
            const folder = item.getAttribute('data-folder');
            const path = item.getAttribute('data-path');
            showEssayReader(essayId, downloadUrl, folder, path);
        });
    });
    document.getElementById('backToCategoriesFromList')?.addEventListener('click', showCategoriesView);
}

// --------------------------------------------------------------
// 4. ESSAY READER (fetches raw markdown from GitHub)
// --------------------------------------------------------------
async function showEssayReader(essayId, downloadUrl, folder, filePath) {
    essayReaderViewDiv.innerHTML = `<div style="max-width:780px; margin:0 auto;">
        <button class="back-nav" id="backToEssayListReader">← Back</button>
        <div class="loading">Loading essay from GitHub...</div>
    </div>`;
    hideAllViews();
    essayReaderViewDiv.classList.remove('hidden');
    document.getElementById('backToEssayListReader')?.addEventListener('click', () => {
        if (currentCategoryId) {
            const cat = CATEGORIES.find(c => c.id === currentCategoryId);
            if (cat) showEssayListForCategory(currentCategoryId, cat.folder);
            else showCategoriesView();
        } else {
            showCategoriesView();
        }
    });
    
    let markdown = "";
    try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error();
        markdown = await response.text();
    } catch (err) {
        markdown = `# Essay not found\n\n> Could not load the markdown file from GitHub. Make sure the file exists at \`${filePath}\` and your repository is public.`;
    }
    
    const rendered = marked.parse(markdown);
    essayReaderViewDiv.innerHTML = `<div style="max-width:780px; margin:0 auto;">
        <button class="back-nav" id="backToEssayListReaderFinal">← Back to essays</button>
        <div class="essay-reader"><div class="essay-content">${rendered}</div></div>
    </div>`;
    document.getElementById('backToEssayListReaderFinal')?.addEventListener('click', () => {
        if (currentCategoryId) {
            const cat = CATEGORIES.find(c => c.id === currentCategoryId);
            if (cat) showEssayListForCategory(currentCategoryId, cat.folder);
            else showCategoriesView();
        } else {
            showCategoriesView();
        }
    });
}

// --------------------------------------------------------------
// 5. STATIC PAGES (About, Newsletter, Links)
// --------------------------------------------------------------
function showAbout() {
    aboutViewDiv.innerHTML = `<div class="section-card">
        <button class="back-nav" id="backHomeAbout">← Home</button>
        <h2>About the writer</h2>
        <p>I write about everyday life, technology, and the quiet spaces in between. This is a home for long‑form essays and thoughtful reading.</p>
        <hr /><p>✉️ essays@thespacesite.com</p>
    </div>`;
    document.getElementById('backHomeAbout')?.addEventListener('click', showHome);
    hideAllViews();
    aboutViewDiv.classList.remove('hidden');
}

function showNewsletter() {
    newsletterViewDiv.innerHTML = `<div class="section-card">
        <button class="back-nav" id="backHomeNews">← Home</button>
        <h2>Newsletter</h2>
        <p>Subscribe for new essays and occasional notes.</p>
        <div class="newsletter-form">
            <input type="email" placeholder="your@email.com" id="newsEmail">
            <button id="subscribeDemo">Subscribe</button>
        </div>
        <p style="font-size:0.75rem;">(Demo — no email stored)</p>
    </div>`;
    document.getElementById('subscribeDemo')?.addEventListener('click', () => {
        const email = document.getElementById('newsEmail')?.value;
        if (email && email.includes('@')) alert(`Demo: welcome email to ${email}`);
        else alert('Valid email please');
    });
    document.getElementById('backHomeNews')?.addEventListener('click', showHome);
    hideAllViews();
    newsletterViewDiv.classList.remove('hidden');
}

function showPersonalLinks() {
    personalLinksViewDiv.innerHTML = `<div class="section-card">
        <button class="back-nav" id="backHomeLinks">← Home</button>
        <h2>Personal & digital spaces</h2>
        <div class="personal-links-list">
            <a href="#">Bluesky / Essays</a>
            <a href="#">Goodreads</a>
            <a href="#">Substack archive</a>
        </div>
        <p>Customize these links in script.js</p>
    </div>`;
    document.getElementById('backHomeLinks')?.addEventListener('click', showHome);
    hideAllViews();
    personalLinksViewDiv.classList.remove('hidden');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// --------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------
document.getElementById('startReadingBtn').addEventListener('click', showCategoriesView);
document.getElementById('homeBtn').addEventListener('click', showHome);
document.getElementById('navAbout').addEventListener('click', (e) => { e.preventDefault(); showAbout(); });
document.getElementById('navNewsletter').addEventListener('click', (e) => { e.preventDefault(); showNewsletter(); });
document.getElementById('navPersonalLinks').addEventListener('click', (e) => { e.preventDefault(); showPersonalLinks(); });
document.getElementById('navLinkedin').addEventListener('click', (e) => { e.preventDefault(); window.open('https://www.linkedin.com/in/example', '_blank'); });

// Show home view initially
showHome();