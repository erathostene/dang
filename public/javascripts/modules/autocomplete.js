function autocomplete(input, latInput, lngInput) {
  if (!input) { return; }
  const dropdown = new google.maps.places.Autocomplete(input);

  dropdown.addListener('place_changed', () => {
    const place = dropdown.getPlace();
    latInput.value = place.geometry.location.lat();
    lngInput.value = place.geometry.location.lng();
  });
  // if someone hit enter in address field, don't submit form
  input.on('keydown', (e) => e.key === 'Enter' && e.preventDefault());
}

export default autocomplete;
