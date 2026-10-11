// Smooth scroll behavior for anchor links
document.addEventListener('DOMContentLoaded', () => {
    // Initialize language
    updatePageLanguage(currentLanguage);
    // Add smooth scrolling to all anchor links
    const anchors = document.querySelectorAll('a[href^="#"]');

    anchors.forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));

            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add fade-in animation on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe feature and download cards
    const cards = document.querySelectorAll('.feature-card, .download-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        observer.observe(card);
    });

    // Update navbar background on scroll
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
        }

        lastScroll = currentScroll;
    });

    // Add copy to clipboard functionality for download links
    const downloadButtons = document.querySelectorAll('.btn-download');

    downloadButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Create a temporary success message
            const originalText = button.innerHTML;
            const icon = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>';

            // Show downloading state
            button.innerHTML = icon + ' Downloading...';
            button.style.pointerEvents = 'none';

            // Reset after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.pointerEvents = 'auto';
            }, 2000);
        });
    });

    // Add hover effect to app preview
    const appPreview = document.querySelector('.app-preview');
    if (appPreview) {
        appPreview.addEventListener('mouseenter', () => {
            appPreview.style.transform = 'scale(1.02)';
            appPreview.style.transition = 'transform 0.3s ease';
        });

        appPreview.addEventListener('mouseleave', () => {
            appPreview.style.transform = 'scale(1)';
        });
    }

    // Update prayer time dynamically (demo)
    const prayerTime = document.querySelector('.prayer-time');
    if (prayerTime) {
        const updateTime = () => {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            prayerTime.textContent = `${hours}:${minutes}`;
        };

        // Update every minute
        updateTime();
        setInterval(updateTime, 60000);
    }

    // Language switcher functionality
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            updatePageLanguage(lang);
        });
    });

    // Ajout de l'année dynamique dans le footer
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
});

// Add keyboard navigation for accessibility
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close any open modals or overlays (if added in the future)
        document.activeElement.blur();
    }
});

// Track analytics events (placeholder for future implementation)
function trackEvent(category, action, label) {
    // This can be connected to analytics services later
    console.log('Event tracked:', { category, action, label });
}

// Track download clicks
document.querySelectorAll('.btn-download').forEach(button => {
    button.addEventListener('click', (e) => {
        const platform = e.target.closest('.download-card').querySelector('h3').textContent;
        trackEvent('Download', 'Click', platform);
    });
});

// Add loading state for external links
document.querySelectorAll('a[target="_blank"]').forEach(link => {
    link.addEventListener('click', () => {
        trackEvent('External Link', 'Click', link.href);
    });
});

// Preload critical images
const preloadImages = () => {
    const imagesToPreload = [
        '../src/assets/icons/app_icon.png'
    ];

    imagesToPreload.forEach(src => {
        const img = new Image();
        img.src = src;
    });
};

preloadImages();

// The latest release's version (the page itself is static). If GitHub can't be reached, the
// version written in the HTML stays.
fetch('https://api.github.com/repos/yassindaboussi/Salaty/releases/latest')
    .then(res => (res.ok ? res.json() : null))
    .then(release => {
        const el = document.getElementById('latest-version');
        if (el && release && release.tag_name) el.textContent = release.tag_name;
    })
    .catch(() => {});
