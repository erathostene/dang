import axios from 'axios';
import dompurify from 'dompurify';

function searchResultsHTML(stores) {
  return stores.map(store => {
    return `
      <a href="/stores/${store.slug}" class="search__result">
      <strong>${store.name}</strong>
      </a>
    `;
  }).join('');
}

function typeAhead(search) {
  if (!search) { return; }
  const searchInput = search.querySelector('input[name="search"]');
  const searchResults = search.querySelector('.search__results');
  searchInput.on('input', function () {
    // if there is no value, quit it
    if (!this.value) { searchResults.style.display = 'none'; return; }

    // show search results
    searchResults.style.display = 'block';
    axios
      .get(`/api/search?q=${this.value}`)
      .then(res => {
        if (res.data.length) {
          return searchResults.innerHTML = dompurify.sanitize(searchResultsHTML(res.data));
        }
        // tell them nothing came back
        searchResults.innerHTML = dompurify.sanitize(`
        <div class="search__result">No results for ${this.value} found !</div>`);
      })
      .catch(err => console.error(err));
  });
  //handle keyboard
  searchInput.on('keyup', (e) => {
    // if they aren't pressing up, down, or enter, who cares
    if (![38, 40, 13].includes(e.keyCode)) { return; }
    const activeClass = 'search__result--active';
    const current = search.querySelector(`.${activeClass}`);
    const items = search.querySelectorAll('.search__result');
    let next;
    switch (e.keyCode) {
      case 40:
        next = current ? (current.nextElementSibling || items[0])
          : items[0];
        break;
      case 38:
        next = current ? (current.previousElementSibling || items[items.length - 1])
          : items[items.length - 1];
        break;
      case 13:
        if (current.href) { return window.location = current.href; }
        break;
    }
    current && current.classList.remove(activeClass);
    next.classList.add(activeClass);
  });
}

export default typeAhead;
