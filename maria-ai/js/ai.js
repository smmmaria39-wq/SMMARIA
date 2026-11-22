
// ==========================================
// MARIA AI — MOBILE SIDEBAR CONTROLS
// ==========================================

const aiSidebar = $('aiSidebar');
const mobileMenuBtn = $('mobileMenuBtn');

// Create the backdrop dynamically
let aiSidebarBackdrop = document.querySelector('.ai-sidebar-backdrop');

if (!aiSidebarBackdrop && aiSidebar) {
    aiSidebarBackdrop = document.createElement('div');
    aiSidebarBackdrop.className = 'ai-sidebar-backdrop';
    aiSidebarBackdrop.setAttribute('aria-hidden', 'true');

    document.querySelector('.ai-shell')?.appendChild(aiSidebarBackdrop);
}

// Close sidebar
function closeAISidebar() {
    aiSidebar?.classList.remove('open');
    aiSidebarBackdrop?.classList.remove('active');

    mobileMenuBtn?.setAttribute('aria-expanded', 'false');
}

// Open sidebar
function openAISidebar() {
    aiSidebar?.classList.add('open');
    aiSidebarBackdrop?.classList.add('active');

    mobileMenuBtn?.setAttribute('aria-expanded', 'true');
}

// Toggle sidebar using menu button
mobileMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();

    if (aiSidebar?.classList.contains('open')) {
        closeAISidebar();
    } else {
        openAISidebar();
    }
});

// Close when clicking anywhere outside the sidebar
document.addEventListener('click', (e) => {
    if (!aiSidebar?.classList.contains('open')) return;

    if (
        aiSidebar.contains(e.target) ||
        mobileMenuBtn?.contains(e.target)
    ) {
        return;
    }

    closeAISidebar();
});

// Close when backdrop is clicked
aiSidebarBackdrop?.addEventListener('click', closeAISidebar);

// Close when Escape is pressed
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAISidebar();
    }
});
