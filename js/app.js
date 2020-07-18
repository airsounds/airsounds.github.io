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

const M = -1000.0 / 3.0
const altTrigger = 4000.0

const X = [0, 50]
const Y = [0, 6000]
const margin = ({top: 30, right: 30, bottom: 40, left: 40})
const hours = [0, 3, 6, 9, 12, 15, 18, 21]
const importantHours = [6, 9, 12, 15, 18]

const xTicks = 10;
const yTicks = 15;

const placeNameTranslate = new Map([
  ["megido", "מגידו"],
  ["sde-teiman", "שדה תימן"],
  ["zefat", "צפת"],
])

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
  idexResp = await fetch("/data/index.json");
  if (!idexResp.ok) {
    error("Failed getting index", `Response: ${idexResp.status}`);
    return;
  }
  idx = await idexResp.json()

  index.$data.places = idx.Locations
  index.$data.currentPlace = idx.Locations[0]
  
  for (i in index.$data.places) {
    place = index.$data.places[i]
    createDays(place, new Date(idx.NoaaEnd))
    place.call = `updatePlace(${i})`;
    place.text = placeNameTranslate.getOrElse(place.name, place.name);
  }

  // Update the plot with the most recent data first.
  console.log("fetching immediate data...")
  hoursIndex = importantHours.filter(h => h <= new Date().getHours()).length-1;
  await fetchData(index.$data.places[0].days[0].hours[hoursIndex])
  updateTime(0, hoursIndex)

  // Fetch all other data in background.
  console.log("fetching all data in background...")
  await fetchAllData();
}

function createDays(place, maxTime) {
  place.days = []

  // Iterate over time slots. Start from today's morning.
  var t = new Date();
  t.setHours(0);

  var dayI = 0
  while (true) {  
    var day = {
      text: dateFormat(t),
      hours: [],
      place: place,
      data: {},
    }
    for (hourI in importantHours) {
      hour = importantHours[hourI]
      t.setHours(hour)
      if (t > maxTime) {
        return
      }
      day.hours.push({
        place: place,
        day: day,
        hour: hour,
        text: pad(hour),
        call: 'updateTime(' + dayI + ', ' + hourI + ')',
        data: {},
      })
    }
    t.setHours(0)
    t.setDate(t.getDate() + 1);
    place.days.push(day)
    dayI++;
  }
}

async function fetchAllData() {
  for (placeI in index.$data.places) {
    place = index.$data.places[placeI]
    for (dayI in place.days) {
      day = place.days[dayI]
      for (hourI in day.hours) {
        hour = day.hours[hourI]
        await fetchData(hour);
      }

      day.data = {
        TIMax: day.hours.map(h => h.data.TI).filter(defined).reduce(max).toFixed(0),
        TIM3Max: day.hours.map(h => h.data.TIM3).filter(defined).reduce(max).toFixed(0),
        isTriggered: day.hours.map(hour => hour.data.isTriggered).reduce((a, b) => a || b),
        cloudBaseMin: day.hours.map(hour => hour.data.cloudBase).filter(defined).reduce(min).toFixed(0),
        cloudBaseMax: day.hours.map(hour => hour.data.cloudBase).filter(defined).reduce(max).toFixed(0),
      }
      index.$forceUpdate() // Update the UI to reflect the aggregation metrics.
    }
  }
}

async function fetchData(hour) {
  console.log(`Fetching ${hour.place.name} at ${hour.day.text} ${hour.text}:00`);
  hour.class = "btn btn-danger";
  
  var datePath = "/data/" + hour.day.text.replace('-', '/').replace('-', '/') + '/' + hour.text + "/";
  const noaaResp = await fetch(datePath + `noaa-${hour.place.name}.json`)
  const imsResp = await fetch(datePath + `ims-${hour.place.name}.json`)

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

  hour.data = {
    noaa: await noaaResp.json(),
    ims: await imsResp.json(),
  }
  hour.class = "btn btn-success";
  console.log(`Successful: ${hour.place.name} at ${hour.day.text} ${hour.text}:00`);
  
  calcData(hour)

  index.$forceUpdate() // Update the time badge in the UI.
}

function calcData(hour) {
  data = hour.data;

  var n = data.noaa['Height'].findIndex(v => v > Y[1])+1;

  data.alt = data.noaa['Height'].slice(0, n);
  data.temp = data.noaa['Temp'].slice(0, n);
  data.dew = data.noaa['Dew'].slice(0, n);
  data.t0 = data.ims['Temp'];
  data.h0 = hour.place.alt; // Ground altitude.

  data.windDir = data.noaa['WindDir'].slice(0, n);
  data.windSpeed = data.noaa['WindSpeed'].slice(0, n);

  // Thermal index calculations.
  var TI = intersect(data.temp, data.alt, data.t0, data.h0, M);
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
  hour = index.$data.places[currentDataIdx.place].days[currentDataIdx.day].hours[currentDataIdx.hour];

  // Update headers.
  header.$data.day = hour.day.text
  header.$data.hour = hour.text
  header.$data.place = hour.place.text
  
  width = currentPlotSize.w;
  height = currentPlotSize.h;
  
  var svg = d3
    .select("#graph")
    .attr("width", width)
    .attr("height", height);
  
  // Clear content before plotting.
  svg.selectAll('*').remove()

  data = hour.data;
  if (jQuery.isEmptyObject(data)) {
    error("No data", "for chosen date");
    return;
  }

  // Scales for axes.

  xScale = d3.scaleLinear()
    .domain(X)
    .nice()
    .range([margin.left, width-margin.right]);
  yScale = d3.scaleLinear()
    .domain(Y)
    .nice()
    .range([height-margin.bottom, margin.top]);

  // Wind drawing is using the same Y axis, but only 1/3 of the X axis.
  xScaleWind = d3.scaleLinear()
    .domain([data.windSpeed.reduce(min), data.windSpeed.reduce(max)])
    .nice()
    .range([margin.left, width/3 - margin.right]);

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
    for (i in data.alt) {
      points.push(({x: params.xScale(x[i]), y: params.yScale(y[i])}));
    }
    
    line = d3.line()
      .curve(d3.curveCatmullRom)
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
      // svg
      //   .append('path')
      //   .attr('d', d3.line()([
      //     [xScale(from[0]), yScale(from[1])],
      //     [xScale(to[0]), yScale(to[1])],
      //   ]))
      //   .attr('stroke', color)
      //   .attr('marker-end', 'url(#arrow)')
      //   .attr('fill', 'none');
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
      size: 13,
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
  for(x0 = X[1]; x0 > X[0]; x0 -= (X[1] - X[0]) / xTicks) {
    drawLine(
      [X[0], x0],
      [y(X[0], x0, Y[0]), Y[0]],
      {color: '#ebecf0'});
  }
  // Draw ground.
  drawPolygon(
    [
      [X[0], Y[0]],
      [X[1], Y[0]],
      [X[1], data.h0],
      [X[0], data.h0],
    ],
    "#D2691E", 1.5)

  // Draw temperature graphs.
  drawLine(data.temp, data.alt, 
    {color: "red", width: 2.5, duration: 1500});
  drawLine(data.dew, data.alt, 
    {color: "blue", width: 2.5, duration: 1500});

  // Draw wind
  drawLine(data.windSpeed, data.alt, 
    {color: "#444444", duration: 1500, xScale: xScaleWind})
  for(i in data.windSpeed) {
    var dir = windDirName(data.windDir[i])
    drawText(data.windSpeed[i], data.alt[i], data.windSpeed[i] + dir,
      {size: 10, xScale: xScaleWind})
  }

  drawText(X[1], data.h0, `Alt ${data.h0} ft`,
    {orient: "top"})
  // Max temperature diagonals.
  drawPolygon(
    [
      [data.t0, data.h0],
      [data.t0-3, data.h0],
      [X[0], y(X[0], data.t0-3, data.h0)],
      [X[0], y(X[0], data.t0, data.h0)],
      
    ],
    "red", 0
  )
  drawLine([X[0], data.t0], [y(X[0], data.t0, data.h0), data.h0], 
    {color: "red"})
  drawPoint(data.t0, data.h0, "red")
  drawText(data.t0, data.h0, "Tmax: "+ data.t0 + "C", 
    {orient: "top"})

  if (data.trig != null) {
    var color = 'green';
    if (!data.isTriggered) {
      color = 'red';
    }
    drawLine([data.t0, data.trig], [data.h0, data.h0],
      {color: color, duration: 2500, arrowSize: 14})
    drawText(data.trig, data.h0, "Trigger: "+ data.trig.toFixed(1) + "C",
      {orient: "bottom"})
  }

  // Thermal indices.
  drawPolygon(
    [
      [X[0], data.TI],
      [X[1], data.TI],
      [X[1], data.TIM3],
      [X[0], data.TIM3]
    ],
    "blue", 0
  )
  drawText(X[1], data.TI, "TI: " + data.TI.toFixed(0) + "ft",
    {orient: "left"})
  drawText(X[1], data.TIM3, "TI-3: " + data.TIM3.toFixed(0) + "ft",
    {orient: "left"})

  // Draw cloud base.
  if (data.cloudBase != null) {
    var cloudBaseY = Math.min(data.cloudBase, Y[1]);
    if (data.cloudBase <= Y[1]) {
      drawLine(
        X, [cloudBaseY, cloudBaseY],
        {color: "blue", duration: 500, dashed: true})
    }
    drawText(X[1], cloudBaseY, "Cloud base: " + data.cloudBase.toFixed(0) + "ft",
      {orient: "left"})
  }

  // Draw axes.
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
        .attr("x", width/3+50)
        .attr("y", 15)
        .attr("font-weight", "bold")
        .attr("text-anchor", "end")
        .attr("fill", "black")
        .text("WindSpeed[kn]")
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

function defined(x) { return x != undefined }
function max(a, b) { return (a > b) ? a : b }
function min(a, b) { return (a < b) ? a : b }

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

main()