// Global active filters set (per leaderboard)
const activeFiltersMap = {};

// Table Update Logic - Optimized for lazy loading
function updateTable(leaderboardName) {
    filterTableRows(leaderboardName);
}

function isAllTagsSelected(leaderboardName) {
    const multiselect = document.getElementById(`tag-multiselect-${leaderboardName}`);
    if (!multiselect) return true;
    const selectedTags = getSelectedTags(leaderboardName);
    const allCheckboxes = multiselect.querySelectorAll('.tag-checkbox:not([value="All"])');
    return selectedTags.length === allCheckboxes.length;
}

// Updated Filter Button Logic
function updateActiveFilters(leaderboardName, filter, isChecked) {
    if (!activeFiltersMap[leaderboardName]) activeFiltersMap[leaderboardName] = new Set(['os_system']);
    if (isChecked) {
        activeFiltersMap[leaderboardName].add(filter);
    } else {
        activeFiltersMap[leaderboardName].delete(filter);
    }
    updateTable(leaderboardName);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Find all leaderboard containers
    document.querySelectorAll('.tabcontent').forEach(tabcontent => {
        const leaderboardName = tabcontent.id.replace('leaderboard-', '');
        activeFiltersMap[leaderboardName] = new Set(['os_system']);

        // Set initial active state for default filters
        tabcontent.querySelectorAll('.filter-checkbox').forEach(checkbox => {
            const filter = checkbox.getAttribute('data-filter');
            checkbox.checked = activeFiltersMap[leaderboardName].has(filter);
        });

        // Add change event to filter checkboxes
        tabcontent.querySelectorAll('.filter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const filter = this.getAttribute('data-filter');
                updateActiveFilters(leaderboardName, filter, this.checked);
            });
        });

        // Initialize selectpickers
        if (window.jQuery && $('.selectpicker').selectpicker) {
            $(`#llm-filter-${leaderboardName}`).selectpicker();
            $(`#method-filter-${leaderboardName}`).selectpicker();
            $(`#features-filter-${leaderboardName}`).selectpicker();
        }
        // Add event listeners for selectpickers
        ['llm-filter', 'method-filter', 'features-filter'].forEach(id => {
            const el = document.getElementById(`${id}-${leaderboardName}`);
            if (el) {
                $(el).on('changed.bs.select', function() {
                    filterTableRows(leaderboardName);
                });
            }
        });

        // Sort by dropdown event listener
        const sortSelect = document.getElementById(`sort-select-${leaderboardName}`);
        if (sortSelect) {
            const colMap = {
                '0.8 PVR': 3,
                '0.9 PVR': 4,
                '0.95 PVR': 5,
                'Area under ARC': 6
            };
            sortSelect.addEventListener('change', function() {
                const value = sortSelect.value;
                const colIdx = colMap[value];
                const table = tabcontent.querySelector('table.data-table');
                if (!table) return;
                sortTableByColumn(table, colIdx, true); // always descending
                filterTableRows(leaderboardName); // re-filter after sorting
            });
            // Initial sort and filter
            sortSelect.dispatchEvent(new Event('change'));
        }

        // Multi-select dropdown logic (if used)
        const multiselect = document.getElementById(`tag-multiselect-${leaderboardName}`);
        if (multiselect) {
            const selected = multiselect.querySelector('.multiselect-selected');
            const options = multiselect.querySelector('.multiselect-options');

            // Toggle dropdown open/close
            selected.addEventListener('click', function(e) {
                multiselect.classList.toggle('open');
                if (multiselect.classList.contains('open')) {
                    options.style.display = 'block';
                } else {
                    options.style.display = 'none';
                }
            });
            document.addEventListener('click', function(e) {
                if (!multiselect.contains(e.target)) {
                    multiselect.classList.remove('open');
                    options.style.display = 'none';
                }
            });

            // Search filter
            window[`filterTagOptions_${leaderboardName}`] = function(input) {
                const filter = input.value.toLowerCase();
                const opts = multiselect.querySelectorAll('.multiselect-option');
                opts.forEach(opt => {
                    if (opt.textContent.toLowerCase().includes(filter) || opt.querySelector('input').value === 'All') {
                        opt.style.display = '';
                    } else {
                        opt.style.display = 'none';
                    }
                });
            };

            // Tag selection logic
            window[`updateTagSelection_${leaderboardName}`] = function() {
                const checkboxes = multiselect.querySelectorAll('.tag-checkbox:not([value="All"])');
                const checked = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
                // Clear previous content
                selected.innerHTML = '';
                if (checked.length === 0) {
                    selected.innerHTML = '<span class="multiselect-placeholder">Select tags...</span>';
                } else if (checked.length === checkboxes.length) {
                    selected.innerHTML = '<span class="multiselect-badge">(All Tags Selected)</span>';
                    multiselect.querySelector('.tag-checkbox[value="All"]').checked = true;
                } else {
                    checked.forEach(tag => {
                        const badge = document.createElement('span');
                        badge.className = 'multiselect-badge';
                        badge.textContent = tag;
                        // Add remove 'x' button
                        const removeBtn = document.createElement('span');
                        removeBtn.className = 'multiselect-badge-remove';
                        removeBtn.textContent = '×';
                        removeBtn.style.marginLeft = '0.5em';
                        removeBtn.style.cursor = 'pointer';
                        removeBtn.onclick = function(e) {
                            e.stopPropagation();
                            // Uncheck the corresponding checkbox
                            const cb = Array.from(multiselect.querySelectorAll('.tag-checkbox')).find(cb => cb.value === tag);
                            if (cb) {
                                cb.checked = false;
                                window[`updateTagSelection_${leaderboardName}`]();
                            }
                        };
                        badge.appendChild(removeBtn);
                        selected.appendChild(badge);
                    });
                    multiselect.querySelector('.tag-checkbox[value="All"]').checked = false;
                }
                filterTableRows(leaderboardName);
            };

            window[`toggleAllTags_${leaderboardName}`] = function(allCb) {
                const checkboxes = multiselect.querySelectorAll('.tag-checkbox:not([value="All"])');
                checkboxes.forEach(cb => cb.checked = allCb.checked);
                window[`updateTagSelection_${leaderboardName}`]();
            };

            // Initial selection
            window[`updateTagSelection_${leaderboardName}`]();
        }

        // Reset Filters logic as a function
        function resetAllFilters() {
            // Reset selectpickers
            ['llm-filter', 'method-filter', 'features-filter'].forEach(id => {
                const el = document.getElementById(`${id}-${leaderboardName}`);
                if (el && window.jQuery && $(el).selectpicker) {
                    $(el).selectpicker('deselectAll');
                }
            });
            // Reset sort-select to first option
            const sortSelect = document.getElementById(`sort-select-${leaderboardName}`);
            if (sortSelect) {
                sortSelect.selectedIndex = 0;
                sortSelect.dispatchEvent(new Event('change'));
            }
            // Select all tags in tag multiselect
            const multiselect = document.getElementById(`tag-multiselect-${leaderboardName}`);
            if (multiselect) {
                multiselect.querySelectorAll('.tag-checkbox:not([value="All"])').forEach(cb => cb.checked = true);
                if (window[`updateTagSelection_${leaderboardName}`]) window[`updateTagSelection_${leaderboardName}`]();
            }
            // Update table
            filterTableRows(leaderboardName);
        }

        // Reset Filters button logic
        const resetBtn = document.getElementById(`reset-filters-btn-${leaderboardName}`);
        if (resetBtn) {
            resetBtn.addEventListener('click', resetAllFilters);
        }

        // Call resetAllFilters at page load
        resetAllFilters();
    });
});

// --- Table Sorting Logic for Dropdown ---
function sortTableByColumn(table, columnIndex, descending) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => {
        const aText = a.children[columnIndex].textContent.trim();
        const bText = b.children[columnIndex].textContent.trim();
        const aNum = parseFloat(aText.replace(/[^\d.\-eE]/g, ''));
        const bNum = parseFloat(bText.replace(/[^\d.\-eE]/g, ''));
        if (isNaN(aNum) || isNaN(bNum)) return 0;
        return descending ? bNum - aNum : aNum - bNum;
    });
    rows.forEach(row => tbody.appendChild(row));
}

// --- Tag Filtering Integration ---
function getSelectedTags(leaderboardName) {
    const multiselect = document.getElementById(`tag-multiselect-${leaderboardName}`);
    if (!multiselect) return [];
    const checkboxes = multiselect.querySelectorAll('.tag-checkbox:not([value="All"])');
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

function filterTableRows(leaderboardName) {
    const tabcontent = document.getElementById(`leaderboard-${leaderboardName}`);
    if (!tabcontent) return;
    const tableRows = tabcontent.querySelectorAll('.data-table tbody tr:not(.no-results)');
    let visibleRowCount = 0;

    // Get selected filter values
    const llmSelected = getSelectedPickerValues(`llm-filter-${leaderboardName}`);
    const methodSelected = getSelectedPickerValues(`method-filter-${leaderboardName}`);
    const featuresSelected = getSelectedPickerValues(`features-filter-${leaderboardName}`);
    const selectedTags = getSelectedTags(leaderboardName);
    const allTagsSelected = isAllTagsSelected(leaderboardName);

    tableRows.forEach(row => {
        let showRow = true;
        // LLM filter
        if (llmSelected.length > 0 && !llmSelected.includes(row.getAttribute('data-llm'))) {
            showRow = false;
        }
        // Method filter
        if (showRow && methodSelected.length > 0 && !methodSelected.includes(row.getAttribute('data-method'))) {
            showRow = false;
        }
        // Features filter
        if (showRow && featuresSelected.length > 0 && !featuresSelected.includes(row.getAttribute('data-features'))) {
            showRow = false;
        }
        // Tag filter
        if (showRow && !allTagsSelected) {
            const rowTags = (row.getAttribute('data-tags') || '').split(',').map(t => t.trim()).filter(Boolean);
            if (!rowTags.some(tag => selectedTags.includes(tag))) {
                showRow = false;
            }
        }
        row.style.display = showRow ? '' : 'none';
        if (showRow) visibleRowCount++;
    });
    const noResultsMessage = tabcontent.querySelector('.no-results');
    if (noResultsMessage) {
        if (visibleRowCount === 0 && (!isAllTagsSelected(leaderboardName) || llmSelected.length > 0 || methodSelected.length > 0 || featuresSelected.length > 0)) {
            noResultsMessage.style.display = 'table-row';
        } else {
            noResultsMessage.style.display = 'none';
        }
    }
}

function getSelectedPickerValues(id) {
    const el = document.getElementById(id);
    if (!el) return [];
    return $(el).val() || [];
}