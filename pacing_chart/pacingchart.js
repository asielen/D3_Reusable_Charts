/**
 * @fileOverview A D3 based chart for tracking pacing against goals. Variation of a bullet chart.
 * @version 1.0
 */
/**
 * Creates a pacing chart
 * @param settings Configuration options for the base plot
 * @param settings.data The data for the plot
 * @param settings.xName The name of the column that should be used for the x groups
 * @param settings.yName The name of the column used for the y values
 * @param {string} settings.selector The selector string for the main chart div
 * @param [settings.axisLabels={}] Defaults to the xName and yName
 * @param [settings.yTicks = 1] 1 = default ticks. 2 =  double, 0.5 = half
 * @param [settings.scale='linear'] 'linear' or 'log' - y scale of the chart
 * @param [settings.chartSize={width:800, height:400}] The height and width of the chart itself (doesn't include the container)
 * @param [settings.margin={top: 15, right: 40, bottom: 40, left: 50}] The margins around the chart (inside the main div)
 * @param [settings.constrainExtremes=false] Should the y scale include outliers?
 * @returns {object} chart A chart object
 */
function makePacingChart(settings) {

    let chart = {};

    // Defaults
    chart.settings = {
        data: null,
        targetsCols: [], // Either a list of strings that is the name of the column or a list of arrays that is [name of col, friendly name of column]
        targetsMarkersCols: [],
        resultsCols: [],
        resultMarkersCols: [],
        titleCols: [], // First one is main, second one is subtitle, any others are ignored
        selector: null,
        chartWidth: 500,
        margin: {top: 5, right: 40, bottom: 20, left: 120},
        barHeight: 25,
        constrainToTarget: false,
        constrainToTargetAdj: 0
    };
    // Copy from function parameters to settings
    for (let setting in settings) {
        chart.settings[setting] = settings[setting]
    }

    chart.formaterValue = (d) => {
        // If no decimals then format without the decimals
        if (d % 1 !== 0) {
            return d3.format(".2f")(d);
        } else {
            return d3.format(".0f")(d);
        }
    }
    chart.formaterPercent = (d) => {
        // If no decimals then format without the decimals
        if ((d*100) % 1 !== 0) {
            return d3.format(",.2%")(d);
        } else {
            return d3.format(",.0%")(d);
        }
    }

    chart.data = chart.settings.data;

    chart.groupObjs = {}; //The data organized by subchart(row)
    chart.objs = {mainDiv: null, chartDiv: null, g: null};

    /** TBD
     * Takes a percentage as returns the values that correspond to that percentage of the group range witdh
     * @param objWidth Percentage of range band
     * @param gName The bin name to use to get the x shift
     * @returns {{left: null, right: null, middle: null}}
     */
    function getObjWidth(objWidth, gName) {
        let objSize = {left: null, right: null, middle: null};
        let width = chart.xScale.rangeBand() * (objWidth / 100);
        let padding = (chart.xScale.rangeBand() - width) / 2;
        let gShift = chart.xScale(gName);
        objSize.middle = chart.xScale.rangeBand() / 2 + gShift;
        objSize.left = padding + gShift;
        objSize.right = objSize.left + width;
        return objSize;
    }

    /** TBD
     * Closure that creates the tooltip hover function
     * @param groupName Name of the x group
     * @param metrics Object to use to get values for the group
     * @returns {Function} A function that provides the values for the tooltip
     */
    function tooltipHover(groupName, metrics) {
        let tooltipString = "Group: " + groupName;
        // tooltipString += "<br\>Max: " + formatAsFloat(metrics.max, 0.1);
        // tooltipString += "<br\>Q3: " + formatAsFloat(metrics.quartile3);
        // tooltipString += "<br\>Median: " + formatAsFloat(metrics.median);
        // tooltipString += "<br\>Q1: " + formatAsFloat(metrics.quartile1);
        // tooltipString += "<br\>Min: " + formatAsFloat(metrics.min);
        return function () {
            chart.objs.tooltip.transition().duration(200).style("opacity", 0.9);
            chart.objs.tooltip.html(tooltipString)
        };
    }

    /**
     * Prepare the chart settings and chart div and svg
     */
    !function prepareSettings() {
        chart.margin = chart.settings.margin;
        chart.divWidth = chart.settings.chartSize.chartWidth;
        chart.barHeight = chart.settings.chartSize.barHeight;
        chart.width = chart.chartWidth - chart.margin.left - chart.margin.right;
        chart.height = (chart.barHeight * 2) - chart.margin.top - chart.margin.bottom; // This is for a single bar
    }();

    /**
     * Read and prepare the raw data (no calculations based on ranges as those could change)
     */
    !function prepareData() {

        function roundUpNearest10(num) {
          return Math.ceil(num / 10) * 10;
        }

        let valueSort = (a, b) => {
            if (a.value < b.value) return -1;
            if (a.value > b.value) return 1;
            return 0;
        }

        // Read the data from the columns
        let parseValues = (columnNames, current_row) => {
            let metricsObj = [];
            for (const column of columnNames) {
                let ref = column;
                let name = column;
                if (typeof column != 'string') {
                    ref = column[0];
                    name = column[1];
                }
                metricsObj.push({column: ref, name: name, value: chart.data[current_row][ref]});
                metricsObj.sort(valueSort);
            }
            return metricsObj;
        }

        function makechartObj(row, index){
            let chartObj = {
                title: "", // If null, the index will be used for internal sorting
                subtitle: null, // Can be null
                index: 0, // For order in presenting
                classes: [], // additional classes for formatting options
                svg: {parent:null,title:null,subtitle:null,targets:null,results:null,targetsMarkers:null,resultsMarkers:null},
                metrics : { //These are the original non-scaled values
                    targets: [],
                    results: [],
                    targetsMarkers: [],
                    resultsMarkers: [],
                    targetsMax: 0, // Largest value of the targets (for if constrain to target is true)
                    metricMax: 0 // Largest value of all metric values
                }
            }
            chartObj.index = index;

            if (typeof chart.settings.titleCols != 'string') {
                    chartObj.title = row[chart.settings.titleCols[0]];
                    chartObj.subtitle = row[chart.settings.titleCols[1]];
            } else {
                chartObj.title = row[chart.settings.titleCols];
            }

            chartObj.metrics.targets = parseValues(chart.settings.targetsCols, index);
            chartObj.metrics.targetsMarkers = parseValues(chart.settings.targetsMarkersCols, index);
            chartObj.metrics.results = parseValues(chart.settings.resultsCols, index);
            chartObj.metrics.resultsMarkers = parseValues(chart.settings.resultMarkersCols, index);
            chartObj.metrics.resultsLastIndex = chartObj.metrics.results.length - 1

            chartObj.metrics.targetsMax = Math.max(...chartObj.metrics.targets.map(o => o.value)); // Right now the largest target is used as the main target. Should this be more flexible?
            chartObj.metrics.targetsMarkersMax = Math.max(...chartObj.metrics.targetsMarkers.map(o => o.value));

            chartObj.metrics.resultsMax = Math.max(...chartObj.metrics.results.map(o => o.value));
            chartObj.metrics.resultsMin = Math.min(...chartObj.metrics.results.map(o => o.value));
            chartObj.metrics.resultsMarkersMax = Math.max(...chartObj.metrics.resultsMarkers.map(o => o.value));
            chartObj.metrics.resultsMarkersMin = Math.min(...chartObj.metrics.resultsMarkers.map(o => o.value));

            chartObj.metrics.metricsMax = Math.max(chartObj.metrics.targetsMax, chartObj.metrics.resultsMax, chartObj.metrics.targetsMarkersMax, chartObj.metrics.resultsMarkersMax);


            // these are used to append classes for formatting in css
            // Calculate percent of max target for results
            chartObj.metrics.results.forEach(result => {
                result.percent_to_target = result.value / chartObj.metrics.targetsMax;
                });

            // Calculate percent of max target for results markers
            chartObj.metrics.resultsMarkers.forEach(result => {
                    result.percent_to_target = result.value / chartObj.metrics.targetsMax;
                });

            // Also the chart object itself gets a class append for the target to results
            chartObj.classes.push((roundUpNearest10((resultsMax/chartObj.metrics.targetsMax)*100)).toString())

            return chartObj;
        }

        let current_obj = null;
        // Create objects for each row in the data
        for (let current_row = 0; current_row < chart.data.length; current_row++) {
            current_obj = makechartObj(chart.data[current_row], current_row);
            if (current_obj.title) chart.groupObjs[current_obj.title] = current_obj;
            else chart.groupObjs[current_obj.index.toString()] = current_obj;
        }
    }();

    /**
     * For each chartObj, calculate the relevant metrics that are affected by the size of the chart
     *  Range, width etc
     * @returns {*}
     */
    chart.update = function (g) {
        console.log(g);
        // Update Settings
        chart.width = chart.chartWidth - chart.margin.left - chart.margin.right;
        chart.height = (chart.barHeight * 2) - chart.margin.top - chart.margin.bottom;

        function calcMethods(metrics) {
            let methods = { //These are the functions to convert raw data to position
                xScale: null,
                widthCalc: null,
                calcPreviousTargetWidth: null,
                calcPreviousResultWidth: null
            };

            if (!chart.settings.constrainToTarget) {
                methods.xScale = d3.scaleLinear()
                    .domain([0, metrics.metricsMax])
                    .range([0, chart.width]);
            } else {
                // We want to keep all ranges at 100%, use the max target as 100%.
                // If this is the case, we may have ranges go over and will need to clamp the data.
                // with the constrainToTargetAdj setting, the max of the bar can be reduced by a percentage to give some space for data larger than the target
                methods.xScale = d3.scaleLinear()
                    .domain([0, metrics.targetsMax*(1+chart.settings.constrainToTargetAdj)])
                    .range([0, chart.width]);
            }

            // Calculate the difference from minScale (=0) to a number
            methods.calcWidth = ((scaleFunc) => {
                // Takes a scale function and gets the 0 position of scale
                // returns a function that gives the difference from the 0 value to "d" as the width
                var x0 = scaleFunc(0); // Xposition at value 0
                return (n) => {
                    // TODO: Handle object instead of value
                    return Math.abs(x(n) - x0);
                };
            })(methods.xScale)

            const calcPreviousWidth = (scaleFunc, values) => {
                return (n,i) => {
                    if (i > 0 && i <= values.length - 1) { // This may need to be reversed to i+1
                        return Math.abs(scaleFunc(n.value) - scaleFunc(values[i - 1].value));
                    } else {
                      return methods.calcWidth(n.value);
                    }
                };
            }

            methods.calcPreviousTargetWidth = calcPreviousWidth(methods.xScale, metrics.targets)
            methods.calcPreviousResultWidth = calcPreviousWidth(methods.xScale, metrics.results)

            const calcPreviousWidthCumm = (scaleFunc, values) => {
                return function(d, i) {
                    if (i > 0 && i < values.length) {
                        let sumScale = 0;
                        for (let j = i; j > 0; j--) {
                            sumScale += scaleFunc(values[j - 1].value) - values[j].value;
                        }
                        return sumScale;
                    } else {
                        return 0;
                    }
                    };
                }

            methods.calcPreviousTargetWidthCumm = calcPreviousWidthCumm(methods.xScale, metrics.targets)
            methods.calcPreviousResultWidthCumm = calcPreviousWidthCumm(methods.xScale, metrics.results)

            // Formatting Methods

            // Targets
            methods.targetBarFormat = (d,i) => {
                let return_text = "target s" + i;
                if (d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return return_text;
            }

            methods.targetTextFormat = (d,i) => {
                // Change what text is shown depending on the size and order of the measures
                // If the width is less than 100, make the font size 12px -- class = less100
                // If width is less than 40px, make invisible -- class = noshow
                // If last item, append class = last
                // All this is done through returning certain css classes
                let return_text = "text s" + i;
                let width = methods.calcPreviousTargetWidth(d, i);
                if (width < 40 && i != metrics.targets.length-1) {
                    return_text += " noshow";
                } else if (width < 100 && i != metrics.targets.length-1) {
                    return_text += " less100px";
                }
                return return_text;
            }

            methods.targetTextXPos = (d,i) => {
                // Find the middle of the bar, to do this we need the end of the previous bar and the end of this bar
                let end = methods.calcWidth(d.value);
                let start = i == 0 ? methods.xScale(0) : Math.max(0, methods.xScale(metrics.targets[i - 1].value) - methods.xScale(d.value));
                return (start + (end - start)) / 2;
            }


            // Results

            methods.resultBarFormat = (d,i) => {
                let return_text = "result s" + i;
                for (let i = 0; i <= d.percent_to_target; i+=.1) {
                    return_text += " p"+`${i*100}`
                }
                if (d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                if (i == metrics.resultsLastIndex) {
                    return_text += " last"
                }
                return return_text;
            }

            methods.resultTextLabel = (d, i) => {
                // Change what text is shown depending on the size and order of the measures
                // If the width is less than 75, don't show the percentage
                // If this is the last item, and it is more than 80%, Only show the number
                // d is the metric and i is the index of that item
                // let perc = d.value / metrics.targetsMax
                let return_text = chart.formaterValue(d.value);
                let width = methods.calcPreviousResultWidth(d, i);
                if ((i == metrics.resultsLastIndex && d.percent_to_target < .8) || (i != metrics.resultsLastIndex && width >= 75)) {
                    // Append percentage if there is room
                    return_text += " (" + chart.formaterPercent(d.percent_to_target) + ")";
                }
                return return_text;
            }

            methods.resultTextXPos = (d,i) => {
                // If this is the last item, adjust the x to the end of the bar rather than on the bar.
                // Otherwise find the middle of the bar, to do this we need the end of the previous bar and the end of this bar
                let end = methods.calcWidth(d.value);
                if (i == metrics.resultsLastIndex) {
                    return end + 4; // 4 = padding between end of bar and text
                } else {
                    let start = i == 0 ? methods.xScale(0) : Math.max(0, methods.xScale(metrics.results[i - 1].value) - methods.xScale(d.value));
                    return (start + (end - start)) / 2;
                }
            }

            methods.resultTextFormat = (d,i) => {
                // Change what text is shown depending on the size and order of the measures
                // If the width is less than 100, make the font size 12px -- class = less100
                // If width is less than 40px, make invisible -- class = noshow
                // If last item, append class = last
                // All this is done through returning certain css classes
                let return_text = "text s" + i;
                let width = methods.calcPreviousResultWidth(d, i);
                if (width < 40 && i != metrics.resultsLastIndex) {
                    return_text += " noshow";
                } else if (width < 100 && i != metrics.resultsLastIndex) {
                    return_text += " less100px";
                }
                return return_text;
            }

            methods.resultsTextAlign = (d, i) => {
                // If it is the last item, align it to the left rather than the middle
                if (i == metrics.resultsLastIndex) {
                  return "left";
                }
                return "middle";
            }

            // Markers
            methods.markerFormat = (d, i) => {
                let return_text = "marker s" + i;
                for (let i = 0; i <= d.percent_to_target; i+=.1) {
                    return_text += " p"+`${i*100}`
                }
                if (d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return return_text;
              };
            return methods;
            }

        function buildChartObj(chartObj) {
            // Update the target rectangles.
            chartObj.svg.targets = chart.objs.g.selectAll("rect.target") // What is g
                .data(chartObj.metrics.targets);


            chartObj.svg.targets.enter().append("rect")
                .attr("class", chartObj.methods.targetBarFormat)
                .attr("width", chartObj.methods.calcPreviousTargetWidth)
                .attr("height", chart.barHeight)
                .attr("x", chartObj.methods.calcPreviousTargetWidthCumm)

            // Target labels
            chartObj.svg.targets.enter().append("text")
                .attr("class", chartObj.methods.targetTextFormat)
                .attr("x", chartObj.methods.targetTextXPos)
                .attr("y", chart.barHeight / 2.2) // TODO why 2.2
                .style("text-anchor", "middle")
                .text(function(d, i) {
                    return chart.formaterValue(d);
                    });

            // Update the result rects.
            chartObj.svg.results = g.selectAll("rect.result")
                .data(chartObj.metrics.results);

            chartObj.svg.results.enter().append("rect")
                .attr("class", chartObj.methods.resultBarFormat)
                .attr("width", chartObj.methods.calcPreviousResultWidth)
                .attr("height", chart.barHeight)
                .attr("x", chartObj.methods.calcPreviousResultWidthCumm) //Get the value of the next item and start x from there
                .attr("y", height * 2) // Move below the target

            chartObj.svg.results.enter().append("text")
                .attr("class", chartObj.methods.resultTextFormat)
                .attr("x", chartObj.methods.resultTextXPos)
                .attr("y", height + 5)
                .style("text-anchor",  chartObj.methods.resultsTextAlign)
                .text(chartObj.methods.resultTextLabel);

            // Update the marker lines.
            chartObj.svg.resultMarkers = g.selectAll("line.resultmarker")
                .data(chartObj.metrics.resultsMarkers);

            chartObj.svg.resultMarkers.enter().append("line")
                .attr("class", chartObj.methods.markerFormat)
                .attr("x1", function(d, i) {return chartObj.methods.xScale(d.value);})
                .attr("x2", function(d, i) {return chartObj.methods.xScale(d.value);})
                .attr("y1", height)
                .attr("y2", height * 2) // 2x height is the bottom of the second bar

        return chartObj;
    }

        g.each(function(d, i) {
            d.methods = calcMethods(d.metrics);
            buildChartObj(d);
        };

    }


    /**
     * Prepare the chart html elements
     */
    !function prepareChart() {
        // Build main div and chart div
        chart.objs.mainDiv = d3.select(chart.settings.selector)
            .style("max-width", chart.divWidth + "px");

        // Add all the divs to make it centered and responsive
        chart.objs.mainDiv.append("div")
            .attr("class", "inner-wrapper")
            .style("padding-bottom", (chart.divHeight / chart.divWidth) * 100 + "%")
            .append("div").attr("class", "outer-box")
            .append("div").attr("class", "inner-box");

        // Capture the inner div for the chart (where the chart actually is)
        chart.selector = chart.settings.selector + " .inner-box";
        chart.objs.chartDiv = d3.select(chart.selector);
        // Resize update hook
        d3.select(window).on('resize.' + chart.selector, chart.update);

        // Create the svg
        chart.objs.g = chart.objs.chartDiv.selectAll("svg")
            .data(chart.metrics)
            .enter().append("svg")
            .attr("class", "pace-chart chart-area")
            .attr("width", chart.width + (chart.margin.left + chart.margin.right))
            .append("g")
            .attr("transform", "translate(" + chart.margin.left + "," + chart.margin.top + ")");
                    // .attr("height", chart.height + (chart.margin.top + chart.margin.bottom))


        chart.objs.titles = chart.objs.g.append("g")
          .style("text-anchor", "end")
          .attr("transform", "translate(-6," + height / 1.4 + ")");

        chart.objs.titles.append("text")
          .attr("class", "title")
          .text(function(d) {
            return d.title;
          });

        chart.objs.titles.append("text")
          .attr("class", "subtitle")
          .attr("dy", "1em")
          .text(function(d) {
            return d.subtitle;
          });

        // Create tooltip div
        chart.objs.tooltip = chart.objs.mainDiv.append('div').attr('class', 'tooltip');
        for (var cName in chart.groupObjs) {
            chart.groupObjs[cName].g = chart.objs.g.append("g").attr("class", "group");
            chart.groupObjs[cName].g.on("mouseover", function () {
                chart.objs.tooltip
                    .style("display", null)
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            }).on("mouseout", function () {
                chart.objs.tooltip.style("display", "none");
            }).on("mousemove", tooltipHover(cName, chart.groupObjs[cName].metrics))
        }
        chart.update(chart.objs.g);
    }();

    return chart;
}
