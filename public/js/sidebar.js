document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleNav');
    const sidebar = document.querySelector('.sidebar');
    
    if (toggleButton && sidebar) {
        toggleButton.addEventListener('click', function() {
            sidebar.classList.toggle('show');
        });
    }
}); 