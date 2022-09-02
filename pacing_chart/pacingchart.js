/**
 * @fileOverview A D3 based chart for tracking pacing against goals. Variation of a bullet chart.
 * @version 1.0
 */
/**
 * Creates a pacing chart
 * @param settings Configuration options for the base plot
 * @param settings.data The data for the plot
 * @param {string} settings.selector The selector string for the main chart div
 * @param settings.targetsCol The name of the columns used to define the targets. It can be defined as an array of strings or an array of arrays where each subarray includes the column name and a display name
 * @param [settings.targetsMarkersCols] The name of the columns used to define the target markers. It can be defined as an array of strings or an array of arrays where each subarray includes the column name and a display name
 * @param settings.resultsCols The name of the columns used to define the results. It can be defined as an array of strings or an array of arrays where each subarray includes the column name and a display name
 * @param [settings.resultsMarkersCols] The name of the columns used to define the results markers. It can be defined as an array of strings or an array of arrays where each subarray includes the column name and a display name
 * @param [settings.titleCols] Array where the first column name is used as a title, the second (optional) one is used as a subtitle. NOTE: Title must be unique, subtitle does not need to be
 * @param settings.chartWidth=500 The Max width of each chart within  the collection of charts
 * @param settings.barHeight=25 The height of each bar, each chart is two stacked charts to this value x2 is the total height of each subchart
 * @param [settings.margin={top: 5, right: 40, bottom: 20, left: 120}] The margins around each sub chart
 * @param [settings.constrainToTarget=false] By default if the results are bigger than the target, the target will scale down and the results will drive the max width. Setting this to true will keep the results as 100% and the target will expand beyond the end. This reduces the max width of all charts to allow for overages
 * @param [settings.constrainToTargetAdj=10] If constrainToTarget is True, this will adjust how much space to give overages
 * @returns {object} chart A chart object
 */

/**
 * Additional Settings that can be set post creation on the returned chart object.
 * chart.formatterValue a function defining how numbers should be formatted
 * chart.formatterPercent a function defining how percents should be formatted
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
        // console.log(groupName, metrics);
        // tooltipString += "<br\>Max: " + ][
        // "formatAsFloat(metrics.max, 0.1);
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
        chart.divWidth = chart.settings.chartWidth;
        chart.barHeight = chart.settings.barHeight;
        chart.width = chart.settings.chartWidth - chart.margin.left - chart.margin.right;
        chart.height = (chart.barHeight * 2) - chart.margin.top - chart.margin.bottom; // This is for a single bar

    }();
    function makeSafeForCSS(name) {
        // https://stackoverflow.com/a/7627603
        // Spaces and _ are replaces with -
        // Special characters are replaced with _
        // Uppercase is replaced with lowercase
        // If starts with a number, append an underscore
        if (!name) {return ''}
        name = name.replace(/[^a-z0-9-]/g, function(s) {
            var c = s.charCodeAt(0);
            if (c == 32 || c == 95) return '-';
            if (c >= 65 && c <= 90) return s.toLowerCase();
            return '_';
        });
        if (name.match(/^[0-9]/g)) {
            // css can't start with a number
            name = "_"+name
        }
        return name
    }

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

            console.log(chartObj);
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
            chartObj.classes.push("p"+(roundUpNearest10((chartObj.metrics.resultsMax/chartObj.metrics.targetsMax)*100)).toString())

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
    chart.update = function (groupObjs) {
        g = groupObjs;
        // Update Settings
        chart.width = chart.settings.chartWidth - chart.margin.left - chart.margin.right;
        chart.height = (chart.barHeight * 2) - chart.margin.top - chart.margin.bottom;

        function calcMethods(metrics) {
            let methods = { //These are the functions to convert raw data to position
                xScale: null,
                widthCalc: null,
                calcPreviousTargetWidth: null,
                calcPreviousResultWidth: null
            };

            console.log(metrics);
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
                var x0 = scaleFunc(0); // Position at value 0
                return (n) => {
                    return Math.abs(scaleFunc(n) - x0);
                };
            })(methods.xScale)

            const calcPreviousWidth = (scaleFunc, values) => {
                return (n,i) => {
                    if (i > 0 && i <= values.length - 1) { // This may need to be reversed to i+1
                        // Current - Previous
                        return Math.abs(scaleFunc(n.value) - scaleFunc(values[i - 1].value));
                    } else {
                        return methods.calcWidth(n.value);
                    }
                };
            }

            methods.calcPreviousTargetWidth = calcPreviousWidth(methods.xScale, metrics.targets)
            methods.calcPreviousResultWidth = calcPreviousWidth(methods.xScale, metrics.results)
            methods.calcTargetViewBox = (value, index) => {
                let vbox = "0 0 "
                vbox += methods.calcPreviousTargetWidth(value, index)//*1.33 // provides extra padding around the text
                vbox += " "+chart.barHeight
                return vbox
            }
            methods.calcResultViewBox = (value, index) => {
                let vbox = "0 0 "
                vbox += methods.calcPreviousResultWidth(value, index)//*1.33 // provides extra padding around the text
                vbox += " "+chart.barHeight
                return vbox
            }


            const calcPreviousX = (scaleFunc, values) => {
                return function(d, i) {
                    if (i > 0 && i <= values.length - 1) {
                        return scaleFunc(values[i - 1].value);
                    } else {
                        return 0;
                    }
                    };
                }


            methods.calcPreviousTargetX = calcPreviousX(methods.xScale, metrics.targets)
            methods.calcPreviousResultX = calcPreviousX(methods.xScale, metrics.results)

            // Formatting Methods

            // Targets
            methods.targetBarFormat = (d,i) => {
                let return_text = "target s" + i;
                return_text += " "+makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                if (d.classes && d.classes.length) {
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
                let return_text = "target text s" + i;
                let width = methods.calcPreviousTargetWidth(d, i);
                if (width < 40 && i != metrics.targets.length - 1) {
                    return_text += " noshow";
                } else if (width < 100 && i != metrics.targets.length - 1) {
                    return_text += " less100px";
                }
                return_text += " " + makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                return return_text;
            }

            methods.targetTextXPos = (d,i) => {
                // Find the middle of the bar, to do this we need the end of the previous bar and the end of this bar
                let end = methods.calcWidth(d.value);
                let start = i === 0 ? methods.xScale(0) : Math.max(0, methods.calcPreviousTargetX(d,i));
                return (start + ((end - start)/ 2)) ;
            }

            // Results

            methods.resultBarFormat = (d,i) => {
                let return_text = "result s" + i;
                for (let i = 0; i <= d.percent_to_target; i+=.1) {
                    return_text += " p"+`${i*100}`
                }
                if (d.classes && d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                // if (i == metrics.resultsLastIndex) {
                //     return_text += " last"
                // }
                return_text += " "+makeSafeForCSS(d.column);
                return_text += " "+makeSafeForCSS(d.title);
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
                if (i === metrics.resultsLastIndex) {
                    return end + 4; // 4 = padding between end of bar and text
                } else {
                    let start = i === 0 ? methods.xScale(0) : Math.max(0, methods.calcPreviousResultX(d,i));
                    return (start + ((end - start)/2));
                }
            }

            methods.resultTextFormat = (d,i) => {
                // Change what text is shown depending on the size and order of the measures
                // If the width is less than 100, make the font size 12px -- class = less100
                // If width is less than 40px, make invisible -- class = noshow
                // If last item, append class = last
                // All this is done through returning certain css classes
                let return_text = "result text s" + i;
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
                if (d.classes && d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return_text += " "+makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                return return_text;
              };
            return methods;
            }

        function buildChartObj(chartObj) {
            // Update the target rectangles.
            chartObj.svg.targets = chart.objs.g.selectAll("rect.target")
                .data(chartObj.metrics.targets)
                .enter()
                .append("svg")
                .attr("class", chartObj.methods.targetBarFormat)
                .attr("width", chartObj.methods.calcPreviousTargetWidth)
                .attr("height", chart.barHeight)
                .attr("x", chartObj.methods.calcPreviousTargetX);
            console.log(chartObj.svg);

            chartObj.svg.targets
                .append("rect")
                .attr("class", chartObj.methods.targetBarFormat)
                .attr("width", chartObj.methods.calcPreviousTargetWidth)
                .attr("height", chart.barHeight)

            chartObj.svg.targets
                .append("svg")
                .attr("viewBox",chartObj.methods.calcTargetViewBox)
                .attr("preserveAspectRatio","xMidYMid meet")
                .append("text")
                .attr("class", chartObj.methods.targetTextFormat)
                .attr("x", '50%')
                .attr("y", '50%')
                .attr("dominant-baseline","middle")
                .attr("text-anchor", "middle")
                .text(function(d, i) {
                    return chart.formaterValue(d);
                    });

            chartObj.svg.results = chart.objs.g.selectAll("rect.result")
                .data(chartObj.metrics.results)
                .enter()
                .append("svg")
                .attr("class", chartObj.methods.resultBarFormat)
                .attr("width", chartObj.methods.calcPreviousResultWidth)
                .attr("height", chart.barHeight)
                .attr("x", chartObj.methods.calcPreviousResultX)
                .attr("y", chart.barHeight)
                .attr("viewBox",chartObj.methods.calcResultViewBox)
                .attr("preserveAspectRatio","xMidYMid meet");

            chartObj.svg.results
                .append("rect")
                .attr("class", chartObj.methods.resultBarFormat)
                .attr("width", chartObj.methods.calcPreviousResultWidth)
                .attr("height", chart.barHeight);

            chartObj.svg.results
                .append("svg")
                .attr("width", "100%")
                .append("text")
                .attr("class", chartObj.methods.resultTextFormat)
                .attr("x", '50%')
                .attr("y", '50%')
                .attr("dominant-baseline","middle")
                .attr("text-anchor", chartObj.methods.resultsTextAlign)
                .text(chartObj.methods.resultTextLabel);


            // Update the marker lines.
            chartObj.svg.resultMarkers = chart.objs.g.selectAll("line.resultmarker")
                .data(chartObj.metrics.resultsMarkers);

            chartObj.svg.resultMarkers.enter().append("line")
                .attr("class", chartObj.methods.markerFormat)
                .attr("x1", function(d, i) {return chartObj.methods.xScale(d.value);})
                .attr("x2", function(d, i) {return chartObj.methods.xScale(d.value);})
                .attr("y1", chart.barHeight)
                .attr("y2", chart.barHeight * 2) // 2x height is the bottom of the second bar

        return chartObj;
        }

        console.log(groupObjs);
        for (const p in groupObjs) {
            groupObjs[p].methods = calcMethods(groupObjs[p].metrics);
            buildChartObj(groupObjs[p]);
        }

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
        d3.select(window).on('resize.' + chart.selector, function() {chart.update(chart.groupObjs)});

        // Create the svg
        chart.objs.g = chart.objs.chartDiv.selectAll("svg")
            .data(chart.data)
            .enter()
            .append("svg")
            .attr("class", "group pace-chart chart-area")
            .attr("width", chart.width + (chart.margin.left + chart.margin.right))
            .append("g");
            // .attr("transform", "translate(" + chart.margin.left + "," + chart.margin.top + ")");
                    // .attr("height", chart.height + (chart.margin.top + chart.margin.bottom))

        chart.objs.titles = chart.objs.g.append("g")
          .style("text-anchor", "end")
          // .attr("transform", "translate(-6," + chart.barHeight / 1.4 + ")");

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

        // Create each chart divs
        chart.objs.g.each(
            function(g,i) {
                for (let cName in chart.groupObjs) {
                    if (cName === g[chart.settings.titleCols[0]]) {
                        // To make the dom elements easier to reference, add them to the chartObjects object
                        chart.groupObjs[cName].g = d3.select(this)
                        chart.groupObjs[cName].g.attr("class",makeSafeForCSS(chart.groupObjs[cName].title)+" "+makeSafeForCSS(chart.groupObjs[cName].subtitle))
                        // Add the mouseover
                        chart.groupObjs[cName].g.on("mouseover", function () {
                            chart.objs.tooltip
                                .style("display", null)
                                .style("left", (d3.event.pageX) + "px")
                                .style("top", (d3.event.pageY - 28) + "px");
                        }).on("mouseout", function () {
                            chart.objs.tooltip.style("display", "none");
                        }).on("mousemove", tooltipHover(cName, chart.groupObjs[cName].metrics))
                    }
                }
            }
        );
        console.log(chart);
        // for (let cName in chart.groupObjs) {
        //     chart.groupObjs[cName].g = chart.objs.g.append("g").attr("class", "group pace-chart chart-area");
        //     chart.groupObjs[cName].g.on("mouseover", function () {
        //         chart.objs.tooltip
        //             .style("display", null)
        //             .style("left", (d3.event.pageX) + "px")
        //             .style("top", (d3.event.pageY - 28) + "px");
        //     }).on("mouseout", function () {
        //         chart.objs.tooltip.style("display", "none");
        //     }).on("mousemove", tooltipHover(cName, chart.groupObjs[cName].metrics))
        // }
        chart.update(chart.groupObjs);
    }();

    return chart;
}


    //https://bl.ocks.org/guypursey/f47d8cd11a8ff24854305505dbbd8c07
    // function wrap(text, width) {
    //     text.each(function() {
    //         var text = d3.select(this),
    //         words = text.text().split(/\s+/).reverse(),
    //         word,
    //         line = [],
    //         lineNumber = 0,
    //         lineHeight = 1.1, // ems
    //         y = text.attr("y"),
    //         dy = parseFloat(text.attr("dy")),
    //         tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em")
    //         while (word = words.pop()) {
    //             line.push(word)
    //             tspan.text(line.join(" "))
    //             if (tspan.node().getComputedTextLength() > width) {
    //                 line.pop()
    //                 tspan.text(line.join(" "))
    //                 line = [word]
    //                 tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", `${++lineNumber * lineHeight + dy}em`).text(word)
    //             }
    //         }
    //     })
    // }
