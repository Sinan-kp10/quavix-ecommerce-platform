document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger-menu');
    const sidebar = document.querySelector('.mobile-sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const closeBtn = document.querySelector('.close-btn');

    if (hamburger && sidebar && overlay && closeBtn) {


        hamburger.addEventListener('click', () => {
            console.log('Opening Sidebar');
            sidebar.classList.add('active');
            overlay.classList.add('active'); 
            document.body.style.overflow = 'hidden'; 
        });


        const closeSidebar = () => {
            console.log('Closing Sidebar');
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = ''; 
        };


        closeBtn.addEventListener('click', closeSidebar);


        overlay.addEventListener('click', closeSidebar);


        document.querySelectorAll('.sidebar-content a').forEach(link => {
            link.addEventListener('click', closeSidebar);
        });
    }

    // Search Suggestions Logic
    const searchInputs = document.querySelectorAll('.nav-search input[name="q"], .mobile-search input[name="q"]');
    let debounceTimer;

    searchInputs.forEach(input => {
        // Create suggestion container and append it after the input
        const suggestionContainer = document.createElement('div');
        suggestionContainer.classList.add('search-suggestions-container');
        suggestionContainer.style.display = 'none';
        
        // Find the parent form to position relative to it
        const form = input.closest('form');
        form.style.position = 'relative'; // Ensure parent is relative
        form.appendChild(suggestionContainer);

        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();

            if (query.length === 0) {
                suggestionContainer.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`/products/search/suggestions?q=${encodeURIComponent(query)}`);
                    const data = await response.json();

                    if (data.success && data.suggestions.length > 0) {
                        suggestionContainer.innerHTML = '';
                        data.suggestions.forEach(product => {
                            const item = document.createElement('a');
                            item.href = `/products/search?q=${encodeURIComponent(product.name)}`;
                            item.classList.add('suggestion-item');
                            
                            item.innerHTML = `
                                <img src="${product.image}" alt="${product.name}" class="suggestion-img" onerror="this.src='/images/placeholder.jpg'">
                                <div class="suggestion-details">
                                    <div class="suggestion-name">${product.name}</div>
                                    <div class="suggestion-price">₹${product.price.toLocaleString()}</div>
                                </div>
                            `;
                            suggestionContainer.appendChild(item);
                        });
                        suggestionContainer.style.display = 'block';
                    } else {
                        suggestionContainer.innerHTML = '<div class="suggestion-no-results">No products found</div>';
                        suggestionContainer.style.display = 'block';
                    }
                } catch (error) {
                    console.error("Failed to fetch suggestions:", error);
                }
            }, 300); // 300ms debounce
        });

        // Hide suggestions when clicking outside the search form
        document.addEventListener('click', (e) => {
            if (!form.contains(e.target)) {
                suggestionContainer.style.display = 'none';
            }
        });
        
        // Show suggestions again when input is focused and has text
        input.addEventListener('focus', () => {
            if (input.value.trim().length > 0 && suggestionContainer.innerHTML !== '') {
                suggestionContainer.style.display = 'block';
            }
        });
    });

})

function increaseCartBadge(qty = 1) {

    const desktopBadge = document.getElementById("cartBadge");
    const mobileBadge = document.getElementById("cartSidebarBadge");

    if (desktopBadge) {
        let count = parseInt(desktopBadge.innerText || 0);
        desktopBadge.innerText = count + qty;
        desktopBadge.style.display = "inline-block";
    }

    if (mobileBadge) {
        let count = parseInt(mobileBadge.innerText || 0);
        mobileBadge.innerText = count + qty;
        mobileBadge.style.display = "inline-block";
    }
}
