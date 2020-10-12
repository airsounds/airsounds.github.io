Date.prototype.addHours= function(h){
  this.setHours(this.getHours()+h);
  return this;
}

Map.prototype.getOrElse = function(key, value) {
  return this.has(key) ? this.get(key) : value
}

var currentTime = new Date();
// Truncate time to 3h.
currentTime.setHours(Math.round(currentTime.getHours() / 3) * 3)

var currentDataIdx = {
  place: 0,
  day: 0,
  hour: 0,
}

const graphMaxRatio = 0.6;
function calcPlotSize() {
  h = $("#graph").parent().height();
  w = $("#graph").parent().width();
  if (w > h * graphMaxRatio) {
    w = h * graphMaxRatio;
  }
  return {w: w, h: h}
}
var currentPlotSize = calcPlotSize();

const forecastDays = 3;
const M = -1000.0 / 3.0;
const altTrigger = 4000.0;

const X = [0, 50];
const Y = [0, 6000];
const margin = ({top: 30, right: 30, bottom: 40, left: 40});
const hours = [0, 3, 6, 9, 12, 15, 18, 21];
const importantHours = [6, 9, 12, 15, 18];
const uwyoHours = [12, 0]; // Hours that the UWYO measurements are given at, reversed.

const xTick = 5;
const yTick = 500;
const axisFontSize = 13;

const placeNameTranslate = new Map([
  ["megido", "מגידו"],
  ["sde-teiman", "שדה תימן"],
  ["zefat", "צפת"],
  ["bet-shaan", "בית שאן"]
]);

async function main() {
  // Resize plot when window is being resized.
  d3.select(window).on('resize.updatesvg', function() {
    size = calcPlotSize()
    if (size.w != currentPlotSize.w || size.h != currentPlotSize.h) {
      currentPlotSize = size;
      plotData()
    }
  });
  
  // Fetch index.
  indexResp = await fetch("/data/index.json");
  if (!indexResp.ok) {
    error("Failed getting index", `Response: ${indexResp.status}`);
    return;
  }
  idx = await indexResp.json();

  index.$data.places = idx.Locations
  index.$data.currentPlace = idx.Locations[0]
  
  index.$data.places.map((place, i) => {
    createDays(place);
    place.call = `updatePlace(${i})`;
    place.text = placeNameTranslate.getOrElse(place.name, place.name);
  });

  // Fetch only first place and first day, to show the UI faster.
  await fetchAllData(true)
  const hoursIndex = max(importantHours.filter(h => h <= new Date().getHours()).length - 1, 0);
  updateTime(0, hoursIndex);

  // Fetch all other data in background.
  console.log("fetching all data in background...");
  await fetchAllData(false);
}

function createDays(place) {
  place.days = []

  // Iterate over time slots. Start from today's morning.
  var t = new Date();
  t.setHours(0);

  for(dayI = 0; dayI < forecastDays; dayI++) {
    var day = {
      text: dateFormat(t),
      hours: [],
      place: place,
      data: {},
    }
    importantHours.map((hour, hourI) => {
      t.setHours(hour)
      day.hours.push({
        place: place,
        day: day,
        hour: hour,
        text: pad(hour),
        call: 'updateTime(' + dayI + ', ' + hourI + ')',
        class: 'btn btn-light',
        data: {},
      })
    });
    t.setHours(0)
    t.setDate(t.getDate() + 1);
    place.days.push(day)
  }
}

// If first is set, fetch only first place. Otherwise fetch all other places.
async function fetchAllData(first) {
  const places = (first) ? [index.$data.places[0]] : index.$data.places.slice(1, index.$data.places.length - 1);
  await Promise.all(places.map(place => fetchPlaceData(place, first)));
}

// If first is set, fetch only first day of place. Otherwise, fetch all other days of the place.
async function fetchPlaceData(place, first) {
  const days = (first) ? [place.days[0]] : place.days.slice(1, place.days.length - 1);
  await Promise.all(days.map(fetchDayData));
}

// Set hoursToFetch to fetch only a specific hours.
async function fetchDayData(day) {
  await Promise.all(
    day.hours.map(fetchHourData) +
    [fetchUWYOData(day)]
  );
  if (day.uwyo != undefined) {
    await Promise.all(day.hours.map(hour => {
      hour.measured = calcData(day.uwyo, hour);
    }));
  }

  day.data = {
    TIMax: day.hours.map(h => h.data.TI).reduce(max).toFixed(0),
    TIM3Max: day.hours.map(h => h.data.TIM3).reduce(max).toFixed(0),
    isTriggered: day.hours.map(hour => hour.data.isTriggered).reduce((a, b) => a || b),
    cloudBaseMin: day.hours.map(hour => hour.data.cloudBase).reduce(min).toFixed(0),
    cloudBaseMax: day.hours.map(hour => hour.data.cloudBase).reduce(max).toFixed(0),
    uwyoHour: day.uwyo == undefined ? "N/A" : day.uwyo.hour,
  }
  day.data.TIText = limitsText(day.data.TIM3Max, day.data.TIMax, ' ft');
  day.data.cloudBaseText = limitsText(day.data.cloudBaseMin, day.data.cloudBaseMax, 'ft');
}

function limitsText(min, max, units) {
  if (min == 0) {
    if (max == 0) {
      return 'N/A';
    } else {
      return '<' + max + units
    }
  }
  return min + '~' + max + units;
}

async function fetchHourData(hour) {
  console.log(`Fetching ${hour.place.name} at ${hour.day.text} ${hour.text}:00`);
  hour.class = "btn btn-danger";
  
  var datePath = "/data/" + hour.day.text.replace('-', '/').replace('-', '/') + '/' + hour.text + "/";
  const [noaaResp, imsResp] = await Promise.all([
    fetch(datePath + `noaa-${hour.place.name}.json`),
    fetch(datePath + `ims-${hour.place.name}.json`),
  ])

  var errors = 0

  if (!noaaResp.ok) {
    console.warn(`NOAA data for ${hour.day.text}, ${hour.text}:00 is not available (${noaaResp.status})`)
    errors++
  }
  if (!imsResp.ok) {
    console.warn(`IMS data for ${hour.day.text}, ${hour.hour}:00 is not available (${imsResp.status})`)
    errors++
  }

  if (errors > 0) {
    return;
  }

  hour.noaa = await noaaResp.json();
  hour.ims = await imsResp.json();

  hour.class = "btn btn-success";
  hour.success = true;
  console.log(`Successful: ${hour.place.name} at ${hour.day.text} ${hour.text}:00`);
  
  hour.data = await calcData(hour.noaa, hour)

  index.$forceUpdate() // Update the time badge in the UI.
}

async function fetchUWYOData(day) {
  for (i in uwyoHours) {
    const hour = pad(uwyoHours[i]);
    const datePath = "/data/" + day.text.replace('-', '/').replace('-', '/') + '/' + hour + "/" + `uwyo-${day.place.uwyo_station}.json`;
    const uwyoResp = await fetch(datePath);
    if (!uwyoResp.ok) {
      continue;
    }
    day.uwyo = await uwyoResp.json();
    day.uwyo.hour = hour + ":00";
    index.$forceUpdate(); // Update the time badge in the UI.
    return;
  }
}

async function calcData(soundingData, hour) {
  var data = {
    alt: soundingData['Height'],
    temp: soundingData['Temp'],
    dew: soundingData['Dew'],
    t0: hour.ims['Temp'], // Temperature at ground level.
    h0: hour.place.alt, // Ground altitude.
    windDir: soundingData['WindDir'],
    windSpeed: soundingData['WindSpeed'],
  }


  // Thermal index calculations.
  var TI = intersect(data.temp, data.alt, data.t0, data.h0, M);
  // Set the thermal index to be not lower than the ground level.
  if (TI != null && TI[1] >= data.h0) {
    data.TI = TI[1];
  } else {
    data.TI = data.h0;
  }
  var TIM3 = intersect(data.temp, data.alt, data.t0-3, data.h0, M);
  if (TIM3 != null && TIM3[1] >= data.h0) {
    data.TIM3 = TIM3[1];
  } else {
    data.TIM3 = data.h0;
  }

  // Cloud base calculation.
  var dewH0 = intersect(data.alt, data.dew, data.h0, 0, 1);
  if (dewH0 != null) {
    data.cloudBase = 1000.0 / 2.5 * (data.t0 - dewH0[1]) + data.h0
    if (data.cloudBase < 0) {
      data.cloudBase = null;
    }
  }

  // Calculate the trigger temperature.
  var altTriggerT = intersect(data.alt, data.temp, altTrigger, 0, 1);
  if (altTriggerT != null) {
    data.trig = x(data.h0, altTriggerT[1], altTrigger)
    data.isTriggered = data.trig <= data.t0
  }

  // Find the maximal Y value, and get the yTick above it.
  data.maxY = [Y[1], data.TI, data.TIM3, data.cloudBase]
    .reduce(max)
  data.maxY = Math.ceil(data.maxY / yTick) * yTick;
  data.minY = Math.floor(data.h0 / yTick) * yTick;

  // Truncate the data values to the maximal Y value.
  var i = max(data.alt.findIndex(v => v > data.minY) - 1, 0);
  var j = data.alt.findIndex(v => v > data.maxY) + 1;

  data.alt = data.alt.slice(i, j);
  data.temp = data.temp.slice(i, j);
  data.dew = data.dew.slice(i, j);
  data.windDir = data.windDir.slice(i, j);
  data.windSpeed = data.windSpeed.slice(i, j);
  
  return data;
}

function y(x, x0, y0) {
  return (x - x0) * M + y0
}

function x(y, x0, y0) {
  return (y - y0) / M + x0
}

var header = new Vue({
  el: '#header',
  data: {
    day: null,
    hour: null,
    place: null,
  },
})

var index = new Vue({
  el: "#index",
  data: {
    places: [],
    currentPlace: {},
  },
})

var errors = new Vue({
  el: "#errors",
  data: {
    errors: [],
  },
})

function dateFormat(d) {
  return d.getFullYear() + "-"
      + pad(d.getMonth()+1) + "-"
      + pad(d.getDate())
}

function hourFormat(d) {
  return pad(d.getHours()) + "h";
}

function timeFormat(d) {
    return dateFormat(d) + " " + hourFormat(d);
}

function timePath(d) {
    return d.getFullYear() + "/"
        + pad(d.getMonth()+1) + "/"
        + pad(d.getDate()) + "/"
        + pad(d.getHours());
}

function pad(n) {
    return n<10 ? '0'+n : n;
}

// Returns point (xi, yi) for which x(y) intersect a line with slope M that goes through (x0, y0).
// Returns null if no intersection.
function intersect(x, y, x0, y0, m0) {

  x0 = 1.0 * x0;
  y0 = 1.0 * y0;
  m0 = 1.0 * m0;

  // Calculate the diff vector.
  var diff = []
  for (i in x) {
    diff.push(x0 + ((y[i] - y0) / m0) - x[i]);
  }

  // Find where diff vector changes from positive to negative value.
  var i = 0
  while (true) {
    if (diff[i] < 0 || i >= diff.length) {
      break;
    }
    i++;
  }

  // No intersection.
  if (i < 1 || i >= diff.length) {
    return null;
  }

  // Find where a line between p1 and p2 crosses the y=0 line.
  p1 = [x[i-1], diff[i-1]]
  p2 = [x[i], diff[i]]
  xi = interpolate(p1, p2, 0)
  
  // Calculate the linear line value in the intersection location.
  yi = y0 + m0 * (xi - x0)
  return [xi, yi]
}

function interpolate(p1, p2, y) {
  m = (p2[1] - p1[1]) / (p2[0] - p1[0])
  return p1[0] - (p1[1] - y) / m
}

function plotData() {
  var hour = currentHour();

  // Update headers.
  header.$data.day = hour.day.text
  header.$data.hour = hour.text
  header.$data.place = hour.place.text
  
  const width = currentPlotSize.w;
  const height = currentPlotSize.h;
  const widthWind = ((width - margin.left - margin.right) / 50.0 * 15) + margin.left + margin.right;
  
  const svg = d3
    .select("#graph")
    .attr("width", width)
    .attr("height", height);
  
  // Clear content before plotting.
  svg.selectAll('*').remove()

  const virtual = hour.data;
  const measured = hour.measured;

  if (jQuery.isEmptyObject(virtual)) {
    virtual = undefined;
  }

  if (virtual == undefined && measured == undefined) {
    error("No data", "for chosen time");
    return;
  }

  // Data for general use.
  const data = virtual || measured;

  // Scales for axes.
  const yLim = [data.minY, data.maxY];
  const xLim = X;
  const xLimWind = [0, 30];

  const xScale = d3.scaleLinear()
    .domain(X)
    .nice()
    .range([margin.left, width - margin.right]);
  const yScale = d3.scaleLinear()
    .domain(yLim)
    .nice()
    .range([height - margin.bottom, margin.top]);

  // Wind drawing is using the same Y axis, but only 1/3 of the xLim axis.
  xScaleWind = d3.scaleLinear()
    .domain(xLimWind)
    .nice()
    .range([margin.left, widthWind - margin.right]);

  function initParams(p, defaults) {
    if (p == undefined) {
      p = {}
    }
    keys = Object.keys(defaults)
    for (i in keys) {
      key = keys[i];
      if (p[key] == undefined) {
        p[key] = defaults[key];
      }
    }
    return p;
  }

  function drawLine(x, y, params) {
    params = initParams(params, {
      color: "black",
      width: 1,
      duration: 0,
      dashed: false,
      arrowSize: 0,
      xScale: xScale,
      yScale: yScale,
    })
    points = []
    for (i in x) {
      points.push(({x: params.xScale(x[i]), y: params.yScale(y[i])}));
    }
    
    line = d3.line()
      .curve(d3.curveLinear)
      .x(d => d.x)
      .y(d => d.y);
    
    function length(path) {
      return d3.create("svg:path").attr("d", path).node().getTotalLength();
    }
    
    const l = length(line(points));
    const dash = (params.dashed) ? "10" : `${l},${l}`;

    if (params.arrowSize > 0) {
      var size = params.arrowSize;
      svg
        .append('defs')
        .append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', [0, 0, size, size])
        .attr('refX', size/2)
        .attr('refY', size/2)
        .attr('markerWidth', size/2)
        .attr('markerHeight', size/2)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', d3.line()([[0, 0], [0, size], [size, size/2]]))
        .attr('stroke', color)
        .attr('fill', color);
    }

    path = svg.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", params.color)
      .attr("stroke-width", params.width)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-dasharray", `0,${l}`)
      .attr("d", line)
      .transition()
        .duration(params.duration)
        .ease(d3.easeLinear)
        .attr("stroke-dasharray", dash);
    if (params.arrowSize > 0) {
      path.attr('marker-end', 'url(#arrow)')
    }
  }
  
  function drawPoint(x, y, color) {
    point = [{x: xScale(x), y: yScale(y)}]
    svg.append("g")
      .attr("fill", "white")
      .attr("stroke", color)
      .attr("stroke-width", 2)
      .selectAll("circle")
      .data(point)
      .join("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 3);
  }

  function drawText(x, y, text, params) {
    params = initParams(params, {
      xScale: xScale,
      size: 14,
      orient: "right",
      color:"black",
    })

    point = [{x: params.xScale(x), y: yScale(y)}]
    const label = svg.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", params.size)
      .attr("font-color", params.color)
      .selectAll("g")
      .data(point)
      .join("g")
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .attr("opacity", 1);
    label.append("text")
      .text(text)
      .each(function(d) {
        const t = d3.select(this);
        switch (params.orient) {
          case "top": t.attr("text-anchor", "middle").attr("dy", "-0.7em"); break;
          case "right": t.attr("dx", "0.5em").attr("dy", "0.32em").attr("text-anchor", "start"); break;
          case "bottom": t.attr("text-anchor", "middle").attr("dy", "1.4em"); break;
          case "left": t.attr("dx", "-0.5em").attr("dy", "0.32em").attr("text-anchor", "end"); break;
        }
      })
      .call(halo);
  }
  function drawPolygon(points, color, width) {
    d = []
    for (i in points) {
      d.push([xScale(points[i][0]), yScale(points[i][1])])
    }
    svg.append("polygon")
      .datum(d)
      .attr("points", pts => pts.map(p => p.join(",")).join(" "))
      .attr("fill", color)
      .attr('opacity', 0.2)
      .attr("stroke", color)
      .attr("stroke-width", width)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
  }

  // Draw diagonal ticks.
  for(x0 = xLim[1]; x0 > xLim[0]; x0 -= xTick) {
    drawLine(
      [xLim[0], x0],
      [y(xLim[0], x0, yLim[0]), yLim[0]],
      {color: '#ebecf0'});
  }
  // Draw ground.
  drawPolygon(
    [
      [xLim[0], yLim[0]],
      [xLim[1], yLim[0]],
      [xLim[1], data.h0],
      [xLim[0], data.h0],
    ],
    "#D2691E", 1.5)
  drawText(xLim[1], virtual.h0, `Alt: ${virtual.h0} ft`,
    {orient: "top"})

  // Draw temperature graphs.
  if (virtual != undefined) {
    drawLine(virtual.temp, virtual.alt, 
      {color: "red", width: 2});
    drawLine(virtual.dew, virtual.alt, 
      {color: "blue", width: 2});
  }
  if (measured != undefined) {
    drawLine(measured.temp, measured.alt, 
      {color: "red", width: 2, dashed: true});
    drawLine(measured.dew, measured.alt, 
      {color: "blue", width: 2, dashed: true});
  }

  // Draw wind
  drawLine(virtual.windSpeed, virtual.alt, 
    {color: "#444444", xScale: xScaleWind})
  for(i in virtual.windSpeed) {
    var dir = windDirName(virtual.windDir[i])
    drawText(virtual.windSpeed[i], virtual.alt[i], virtual.windSpeed[i] + dir,
      {size: 10, xScale: xScaleWind})
  }
  if (measured != undefined) {
    drawLine(measured.windSpeed, measured.alt, 
      {color: "#444444", xScale: xScaleWind, dashed: true})
    for(i in measured.windSpeed) {
      var dir = windDirName(measured.windDir[i])
      drawText(measured.windSpeed[i], measured.alt[i], measured.windSpeed[i] + dir,
        {size: 10, xScale: xScaleWind, color: '#444444'})
    }
  }

  // Max temperature diagonals.
  drawPolygon(
    [
      [virtual.t0, virtual.h0],
      [virtual.t0-3, virtual.h0],
      [xLim[0], y(xLim[0], virtual.t0-3, virtual.h0)],
      [xLim[0], y(xLim[0], virtual.t0, virtual.h0)],
      
    ],
    "red", 0
  )
  drawPoint(virtual.t0, virtual.h0, "red")
  drawText(virtual.t0, virtual.h0, "T0: "+ virtual.t0 + "ºC",
    {orient: "top"})

  if (virtual.trig != null) {
    var color = 'green';
    if (!virtual.isTriggered) {
      color = 'red';
    }
    drawLine([virtual.t0, virtual.trig], [virtual.h0, virtual.h0],
      {color: color, duration: 2500, arrowSize: 14})
    drawText(virtual.trig, virtual.h0, "Trigger: "+ virtual.trig.toFixed(1) + "ºC",
      {orient: "bottom"})
  }

  // Thermal indices.
  drawPolygon(
    [
      [xLim[0], virtual.TI],
      [xLim[1], virtual.TI],
      [xLim[1], virtual.TIM3],
      [xLim[0], virtual.TIM3]
    ],
    "blue", 0
  )
  if (virtual.TI != data.h0) {
    drawText(xLim[1], virtual.TI, "TI (virt): " + virtual.TI.toFixed(0) + "ft",
      {orient: "left"})
  }
  if (virtual.TIM3 != data.h0) {
    drawText(xLim[1], virtual.TIM3, "TI-3 (virt): " + virtual.TIM3.toFixed(0) + "ft",
      {orient: "left"})
  }
  if (measured != undefined) {
    drawPolygon(
      [
        [xLim[0], measured.TI],
        [xLim[1], measured.TI],
        [xLim[1], measured.TIM3],
        [xLim[0], measured.TIM3]
      ],
      "green", 0
    )
    if (measured.TI != data.h0) {
      drawText(xLim[1], measured.TI, "TI (measured): " + measured.TI.toFixed(0) + "ft",
        {orient: "left"})
    }
    if (measured.TIM3 != data.h0) {
      drawText(xLim[1], measured.TIM3, "TI-3 (measured): " + measured.TIM3.toFixed(0) + "ft",
        {orient: "left"})
    }
  }

  // Draw cloud base.
  if (virtual.cloudBase != null) {
    var cloudBaseY = Math.min(virtual.cloudBase, yLim[1]);
    if (virtual.cloudBase <= yLim[1]) {
      drawLine(
        xLim, [cloudBaseY, cloudBaseY],
        {color: "blue", duration: 500, dashed: true})
    }
    drawText(xLim[1], cloudBaseY, "Cloud base (virt): " + virtual.cloudBase.toFixed(0) + "ft",
      {orient: "left"})
  }

  if (measured != undefined && measured.cloudBase != null) {
    var cloudBaseY = Math.min(measured.cloudBase, yLim[1]);
    if (measured.cloudBase <= yLim[1]) {
      drawLine(
        xLim, [cloudBaseY, cloudBaseY],
        {color: "blue", duration: 500, dashed: true})
    }
    drawText(xLim[1], cloudBaseY, "Cloud base (measured): " + measured.cloudBase.toFixed(0) + "ft",
      {orient: "left"})
  }

  // Draw axes.
  var yTicks = (yLim[1] - yLim[0]) / yTick;
  var xTicks = (xLim[1] - xLim[0]) / xTick;
  xAxis = g => g
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(xScale).ticks(xTicks))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").clone()
        .attr("y2", -height)
        .attr("stroke-opacity", 0.2))
    .call(g => g.append("text")
        .attr("x", width)
        .attr("y", 15)
        .attr("font-weight", "bold")
        .attr("text-anchor", "end")
        .attr("fill", "black")
        .text("T[c]")
        .call(halo))
  yAxis = g => g
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yScale).ticks(yTicks, "s"))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").clone()
        .attr("x2", width)
        .attr("stroke-opacity", 0.2))
    .call(g => g.select(".tick:last-of-type text").clone()
        .attr("x", -margin.left)
        .attr("y", -20)
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .attr("fill", "black")
        .text("H[ft]")
        .call(halo))
  
  xAxisWind = g => g
    .attr("transform", `translate(0,${height - margin.bottom/2})`)
    .call(d3.axisBottom(xScaleWind).ticks(5))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").clone()
        .attr("y2", -height)
        .attr("stroke-opacity", 0.05))
    .call(g => g.append("text")
        .attr("x", widthWind - 18)
        .attr("y", 17)
        .attr("font-weight", "bold")
        .attr("text-anchor", "start")
        .attr("fill", "black")
        .text("Wind [kn]")
        .call(halo))

  svg.append("g").call(xAxis);
  svg.append("g").call(yAxis);
  svg.append("g").call(xAxisWind);

  function halo(text) {
    text.select(function() { return this.parentNode.insertBefore(this.cloneNode(true), this); })
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 4)
        .attr("stroke-linejoin", "round");
  }
}

async function updateTime(dayi, houri) {

  if (jQuery.isEmptyObject(index.$data.currentPlace.days[dayi].hours[houri].data)) {
    error("Not available", "Chosen day and hour are not available")
    return;
  }

  // Hide menus.
  $('#datesPicker').collapse('hide');
  $('#placePicker').collapse('hide');

  currentDataIdx.day = dayi
  currentDataIdx.hour = houri

  plotData();
}

async function updatePlace(placeI) {
  // Hide menus.
  $('#datesPicker').collapse('hide');
  $('#placePicker').collapse('hide');

  currentDataIdx.place = placeI
  index.$data.currentPlace = index.$data.places[placeI]

  plotData();
}

function error(title, msg) {
  errors.$data.errors.push({title: title, text: msg})  
}

function max(a, b) {
  if (a == undefined && b == undefined) {
    return 0;
  }
  if (a == undefined) {
    return b;
  }
  if (b == undefined) {
    return a;
  }
  return (a > b) ? a : b;
}

function min(a, b) {
  if (a == undefined && b == undefined) {
    return 0;
  }
  if (a == undefined) {
    return b;
  }
  if (b == undefined) {
    return a;
  }
  return (a < b) ? a : b;
}

function windDirName(v) {
  const dirs = [
    'N', 'NNW', 'NW', 'NWW',
    'W', 'SWW', 'SW', 'SSW',
    'S', 'SSE', 'SE', 'SEE',
    'E', 'NEE', 'NE', 'NNE',
  ]
  var part = 360 / dirs.length
  var i = Math.floor((v + part/2) / part)
  return dirs[i]
}

function placesDropdownClick() {
  $('#datesPicker').collapse('hide');
  $('#placePicker').collapse('toggle');
}

function datesDropdownClick() {
  $('#datesPicker').collapse('toggle');
  $('#placePicker').collapse('hide');
}

function showInfo() {
  document.getElementById('info').style.display = "block"
}

function hideInfo() {
  document.getElementById('info').style.display = "none"
}

function currentPlace() {
  return index.$data.places[currentDataIdx.place];
}

function currentDay() {
  return currentPlace().days[currentDataIdx.day];
}

function currentHour() {
  return currentDay().hours[currentDataIdx.hour];
}

main();