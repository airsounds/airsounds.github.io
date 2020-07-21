# airsounds

A website that provides upper-air soundings forecast for Israeli locations.

Check it out on https://airsounds.github.io.

## How it works?

Github [actions](https://github.com/airsounds/airsounds.github.io/actions) are used to
fetch soundings forecast data from [noaa.gov](https://www.noaa.gov) and temperatures
forecast from [ims.gov.il](https://ims.gov.il). They commit the data to the
[`/data`](https://github.com/airsounds/airsounds.github.io/tree/master/data) directory.

Github pages is used for static static surving of this repository on
[airsounds.github.io](https://airsounds.github.io). The
[`index.html`](https://github.com/airsounds/airsounds.github.io/blob/master/index.html)
is loaded, and the [`js/app.js`](https://github.com/airsounds/airsounds.github.io/blob/master/js/app.js)
is used to fetch the data (which is also statically served by Github pages), process it
and present it to the user.
