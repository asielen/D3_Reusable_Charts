/**
 * @fileOverview A D3 based chart for tracking progress against goals. Variation of a bullet chart.
 * @version 1.0
 * Tested on d3 v6 and v7
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
 * @param [settings.titleCols] Array where the first column name is used as a title, the second (optional) one is used as a subtitle.
 * @param settings.chartWidth=500 The Max width of each chart within  the collection of charts
 * @param settings.barHeight=35 The height of each bar, each chart is two stacked charts to this value x2 is the total height of each subchart
 * @param settings.titlePadding=100 How much space to the left of the charts should be allocated to the title. The bar chart portion is adjusted down to the remaining space
 * @param settings.lowerSummaryPadding=20 How much space to add below the charts to allow for results if the results exceed the end of the chart
 * @param settings.minWidthForPercent=100 The minimum numbers of pixels a result bar will be for the percent to be shown. Below this threshold, only the value is rendered
 * @param settings.cumulativeTargets=true If true, the targets are subsets of each other ie. the largest target is the total target. If false, the total target is the sum of all the targets.
 * @param settings.cumulativeResults=true If true, the results are subsets of each other ie. the largest result is the total result. If false, the total result is the sum of all the results.
 * @param settings.summarizeTargets=false If true, show a separate bar above the targets that is a sum of all the individual targets, mostly useful when paired with cumulativeTargets=false
 * @param settings.summarizeResults=false If true, show a separate bar above the results that is a sum of all the individual results, mostly useful when paired with cumulativeResults=false
 * @returns {object} A chart object
 */
function makePacingChart(settings) {

    let chart = {};

    // Defaults
    chart.settings = {
        data: null,
        selector: null,
        targetsCols: [],
        targetsMarkersCols: [],
        resultsCols: [],
        resultMarkersCols: [],
        titleCols: [],
        linkCol: null,
        chartWidth: 450,
        barHeight: 30,
        titlePadding: 75,
        lowerSummaryPadding: 20,
        minWidthForPercent: 100,
        cumulativeTargets: true,
        cumulativeResults: true,
        summarizeTargets: false,
        summarizeResults: false,
        barRadiusTargets: {t:{l:4,i:0,r:4},b:{l:0,i:0,r:0},hang:true}, // top [left, inside, right], bottom [left, inside, right], if hang = true, then curve top and bottom with the same radius even if it isn't specified
        barRadiusResults: {t:{l:0,i:0,r:0},b:{l:4,i:0,r:4},hang:true}, // top [left, inside, right], bottom [left, inside, right]
        w_threshold: 25,
        p_threshold: .1,
        _constrainToTarget: false, // Not implemented
    };

    chart.groupObjs = {};
    chart.objs = {mainDiv: null, chartDiv: null, g: null};

    /**
    * Allows settings to be updated by calling chart.set after initialization but before update.
    * Useful if some settings are templatized (the same multiple places).
     * Built so that the functions that can be overridden, can also be defined here.
     *  ie. chart.set(formatterValue=newFunct) This way you can chain the settings update calls.
     *  This also means that these functions can be set at initialization since that also calls chart.set
     * @param settings_map A key:value map of settings.
     * @return the chart object so it can be chained
     */
    chart.set = (settings_map) => {
        let dataUpdated = false;
        for (let setting in settings_map) {
            chart.settings[setting] = settings_map[setting]
            if (setting === 'data') {chart.data = chart.settings.data; dataUpdated=true}
            if (['formatterValue','formatterValueToolTip','formatterPercent','tooltipGenerator'].includes(setting) && typeof settings_map[setting] === 'function'){
                // If it is one of the pre-defined functions, update that function
                chart[setting] = settings_map[setting];
            }
        }
        // Update base layout settings
        chart.width = chart.settings.chartWidth;
        chart.height = (chart.settings.barHeight * (2 + chart.settings.summarizeTargets + chart.settings.summarizeResults) + chart.settings.lowerSummaryPadding)
        chart.barWidth = chart.settings.chartWidth - chart.settings.titlePadding;
        chart.barHeight = chart.settings.barHeight;

        // If the data was updated, reinitialize base metrics
        if (dataUpdated){
            prepareData()
        }
        return chart;
    }


    /**
     * Read and prepare the raw data (no calculations based on ranges as those could change).
     */
    function prepareData() {

        /**
         * Return num rounded to the nearest 10.
         *  11 -> 10, 26 -> 30 etc
         * For tagging the bars with classes based on each 10%
         */
        function roundUpNearest10(num) {
          return Math.round(Math.ceil(num / 10) * 10);
        }

        let valueSort = (a, b) => {
            if (a.value < b.value) return -1;
            if (a.value > b.value) return 1;
            return 0;
        }

        /**
         * Parse the data based on the column names provided
         */
        let parseValues = (columnNames, current_row, is_cumulative) => {
            let metricsObj = [];
            for (const column of columnNames) {
                let ref = column;
                let name = column;
                if (typeof column != 'string') {
                    ref = column[0];
                    name = column[1];
                }
                metricsObj.push({column: ref, name: name, value: chart.data[current_row][ref]});
                // If the targets or results are additive, not cumulative. The order presented in the setup will be kept.
                // Otherwise, they will be sorted by value.
                if (!is_cumulative) {metricsObj.sort(valueSort)}
            }
            return metricsObj;
        }

        /**
         * Each ChartObj is one of the "subcharts". This corresponds to one row of data
         */
        function makechartObj(row, index){
            let chartObj = {
                title: "",
                subtitle: null,
                index: 0,
                classes: [],
                unique_id: "",
                svg: {parent:null,title:null,subtitle:null,targets:null,results:null,targetsMarkers:null,resultsMarkers:null},
                metrics : {},
                link: ""
            }
            chartObj.index = index;
            chartObj.unique_id = "g"+index+"-"+Math.random().toString(16).slice(2)
            row.unique_id = chartObj.unique_id;

            if (typeof chart.settings.titleCols != 'string') {
                    chartObj.title = row[chart.settings.titleCols[0]];
                    chartObj.subtitle = row[chart.settings.titleCols[1]];
            } else {
                chartObj.title = row[chart.settings.titleCols];
            }

            if (chart.settings.linkCol) {
                chartObj.link = row[chart.settings.linkCol];
            }

            chartObj.metrics.targets = parseValues(chart.settings.targetsCols, index, chart.settings.cumulativeTargets);
            chartObj.metrics.targetsMarkers = parseValues(chart.settings.targetsMarkersCols, index, chart.settings.cumulativeTargets);
            chartObj.metrics.targetsLastIndex = chartObj.metrics.targets.length - 1
            chartObj.metrics.results = parseValues(chart.settings.resultsCols, index, chart.settings.cumulativeResults);
            chartObj.metrics.resultsMarkers = parseValues(chart.settings.resultMarkersCols, index, chart.settings.cumulativeResults);
            chartObj.metrics.resultsLastIndex = chartObj.metrics.results.length - 1

            // Depending on the settings, these are used to identify the max width of the bars
            // The standard is that the largest value across all measures is the max width.
            chartObj.metrics.targetsMax = !chart.settings.cumulativeTargets ? chartObj.metrics.targets.map(o => +o.value).reduce((a,b)=>a+b) : Math.max(...chartObj.metrics.targets.map(o => o.value)); // The largest target is used as the main target. Should this be more flexible?
            chartObj.metrics.targetsMarkersMax = Math.max(...chartObj.metrics.targetsMarkers.map(o => o.value));

            chartObj.metrics.resultsMax = !chart.settings.cumulativeResults ? chartObj.metrics.results.map(o => +o.value).reduce((a,b)=>a+b) : Math.max(...chartObj.metrics.results.map(o => o.value));
            chartObj.metrics.resultsMin = Math.min(...chartObj.metrics.results.map(o => o.value));
            chartObj.metrics.resultsMarkersMax = Math.max(...chartObj.metrics.resultsMarkers.map(o => o.value));
            chartObj.metrics.resultsMarkersMin = Math.min(...chartObj.metrics.resultsMarkers.map(o => o.value));

            chartObj.metrics.metricsMax = Math.max(chartObj.metrics.targetsMax, chartObj.metrics.resultsMax, chartObj.metrics.targetsMarkersMax, chartObj.metrics.resultsMarkersMax);

            chartObj.metrics.targetGreater = 0; // If 0 target and results are within 5%, if 1, target is larger, if -1, results is larger.
                                                //  for bar radius calculation. Calculated with the xscale method in the methods function.


            // Calculate percent of max target for results
            // Used to tag with classes for css formatting
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
            chart.groupObjs[current_obj.unique_id] = current_obj;
        }
    }


    // These three formatter functions can be overwritten before rendering

    /**
     * Main formatter function used for display of values in bars
     */
    chart.formatterValue = (d) => {
        // If no decimals then format without the decimals
        let dmod = Math.ceil(Math.log10(d + 1)) % 3;
        if (dmod === 0) {
            // If there are decimal points
            return d3.format(".3s")(d);
        } else {
            return d3.format("."+(dmod+1)+"s")(d);
        }
    }
    /**
     * Main formatter function used for display of values in the tool tip
     */
    chart.formatterValueToolTip = (d) => {
        // Always return at least 1 decimal in abbreviated view
        let dmod = Math.ceil(Math.log10(d + 1))%3;
        if (dmod === 0) {
            // If there are decimal points
            return d3.format(".5s")(d);
        } else {
            return d3.format("."+(dmod+2)+"s")(d);
        }
    }
    /**
     * Main formatter function used for display of percentages in bars and the tooltip
     */
    chart.formatterPercent = (d) => {
        // If no decimals then format without the decimals
        if ((d*100) % 1 !== 0) {
            return d3.format(",.2%")(d);
        } else {
            return d3.format(",.0%")(d);
        }
    }

    /**
     * An example tooltip generator that takes the object the cursor is
     *  hovering over as a parameter and returns a text string.
     * This method can be customized and overwritten.
     * @param groupObj the subchart object with all properties of the subchart
     * @param event the data of the specific object that is being hovered over, which is a subelement of the subchart
     * @returns an html string that will be injected into the tooltip
     */
    chart.tooltipGenerator = function(groupObj, event){
        let tooltipString = '<span class="chart title">'+groupObj.title;
        if (groupObj.subtitle) {
            tooltipString += " "+groupObj.subtitle;
        }
        let selected = "";
        tooltipString += '</span><hr>Targets:'

        let target_total = 0;
        let target_string = ""
        for (const target of groupObj.metrics.targets) {
            if (event.name === target.name) {selected = "selected"}
            if (chart.settings.cumulativeTargets) {
                if (target.value > target_total) {target_total = target.value}
            } else {
                target_total += target.value
            }
            target_string += "<span class='"+selected+"'><span class='target title'>"+target.name+"</span> : <span class='target value '>"+chart.formatterValueToolTip(target.value)+"</span></span><br \>"
            selected = ""
        }
        if (groupObj.metrics.targets.length > 1) {
            tooltipString += " "+chart.formatterValueToolTip(target_total)+"<br \>"
        } else {
            tooltipString += "<br \>"
        }
        tooltipString += target_string

        for (const target of groupObj.metrics.targetsMarkers) {
            if (event.name === target.name) {selected = "selected"}
            tooltipString += "<span class='"+selected+"'><span class='target-metrics title '>> "+target.name+"</span> : <span class='target-metrics value '>"+chart.formatterValueToolTip(target.value)+"</span></span><br \>"
            selected = ""
        }

        tooltipString += '<hr>Results:'

        let result_total = 0;
        let result_string = ""
        for (const result of groupObj.metrics.results) {
            if (event.name === result.name) {selected = "selected"}
            if (chart.settings.cumulativeResults) {
                if (result.value > result_total) {result_total = +result.value}
            } else {
                result_total += +result.value
            }
            result_string += "<span class='"+selected+"'><span class='result title '>"+result.name+"</span> : <span class='result value '>"+chart.formatterValueToolTip(result.value)+" | "+chart.formatterPercent(result.percent_to_target)+"</span></span><br \>"
            selected = ""
        }
        if (groupObj.metrics.results.length > 1) {
            tooltipString += " "+chart.formatterValueToolTip(result_total)+"<br \>"
        } else {
            tooltipString += "<br \>"
        }
        tooltipString += result_string

        for (const result of groupObj.metrics.resultsMarkers) {
            if (event.name === result.name) {selected = "selected"}
            tooltipString += "<span class='"+selected+"'><span class='result-marketer title '>> "+result.name+"</span> : <span class='result-marker value '>"+chart.formatterValueToolTip(result.value)+" | "+chart.formatterPercent(result.percent_to_target)+"</span></span><br \>"
            selected = ""
        }
        return tooltipString
    }

    /**
     * Renders the tooltip defined in the tooltip Generator.
     */
    function tooltipRender(groupObj, event) {
        return function () {
            chart.objs.tooltip.transition().duration(200);
            chart.objs.tooltip.html(chart.tooltipGenerator(groupObj, event))
        };
    }

    /**
     * Takes a string and makes it css class safe.
     * @param name a text string.
     * @returns {string} A text string that cab be used as a css class
     */
    function makeSafeForCSS(name) {
        // Modified from https://stackoverflow.com/a/7627603
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
     * For each chartObj, calculate the relevant metrics that are affected by the size of the chart
     *  Range, width etc
     */
    chart.update = function () {

        function calcMethods(metrics) {
            //These are the methods to convert raw data to position
            let methods = {
                xScale: null,
                widthCalc: null,
                calcTargetWidth: null,
                calcResultWidth: null
            };

            if (!chart.settings._constrainToTarget) {
                methods.xScale = d3.scaleLinear()
                    .domain([0, metrics.metricsMax])
                    .range([0, chart.barWidth]);
            } else { // NOTE: Not Implemented
                // We want to keep all ranges at 100%, use the max target as 100%.
                // If this is the case, we may have ranges go over and will need to clamp the data.
                //  with the constrainToTargetAdj setting, the max of the bar can be reduced by a percentage to give some space for data larger than the target
                methods.xScale = d3.scaleLinear()
                    .domain([0, metrics.targetsMax]) // * (1+chart.settings.constrainToTargetAdj)
                    .range([0, chart.barWidth]);
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

            const calcPreviousWidth = (scaleFunc, values, cumulative) => {
                return (n,i) => {
                    if (i > 0 && i <= values.length - 1 && cumulative) {
                        return Math.abs(scaleFunc(n.value) - scaleFunc(values[i - 1].value));
                    } else {
                        return methods.calcWidth(n.value);
                    }
                };
            }

            methods.calcTargetWidth = calcPreviousWidth(methods.xScale, metrics.targets, chart.settings.cumulativeTargets);
            methods.calcResultWidth = calcPreviousWidth(methods.xScale, metrics.results, chart.settings.cumulativeResults);

            methods.calcTargetMarkerX = (n) => {return methods.calcWidth(n.value)+chart.settings.titlePadding};
            methods.calcResultMarkerX = (n) => {return methods.calcWidth(n.value)+chart.settings.titlePadding};

            const calcPreviousX = (scaleFunc, values) => {
                return function(d, i) {
                    let x = chart.settings.titlePadding;
                    if (i > 0 && i <= values.length - 1) {
                        return x + scaleFunc(values[i - 1].value);
                    } else {
                        return x;
                    }
                };
            }

            const calcCumPreviousX = (scaleFunc, values) => {
                // For cumulative need to add the previous x with the previous width. Not just the previous width
                return function(d,i) {
                    let c = chart.settings.titlePadding;
                    if (i > 0 && i <= values.length - 1) {
                        for (let j = i-1; j >= 0; j--) {
                            c += scaleFunc(values[j].value)
                        }
                        return c;
                    } else {
                        return c;
                    }
                };
            }

            methods.calcTargetX = chart.settings.cumulativeTargets ? calcPreviousX(methods.xScale, metrics.targets) : calcCumPreviousX(methods.xScale, metrics.targets);
            methods.calcResultX = chart.settings.cumulativeResults ? calcPreviousX(methods.xScale, metrics.results) : calcCumPreviousX(methods.xScale, metrics.results);
            metrics.targetGreater = methods.calcWidth(metrics.targetsMax) - methods.calcWidth(metrics.resultsMax);

            const pathFactory = (width_func, radius, last_index, hang_check, hasSummary, isSummary) => {
                return function(d,i) {
                    let r = {t:{l:0,i:0,r:0},b:{l:0,i:0,r:0},hang:true} // radius = top [left, inside, right], bottom [left, inside, right]
                    let w = width_func(d, i)
                        , h = chart.barHeight

                    // Left side
                    if (i !== 0) {
                        r.t.l = radius.t.i;
                        r.b.l = radius.b.i;
                    } else {
                        r.t.l = hasSummary ? 0 : radius.t.l;
                        r.b.l = isSummary ? 0 : radius.b.l;
                    }
                    // Right Side
                    if (i !== last_index) {
                        r.t.r = radius.t.i;
                        r.b.r = radius.b.i;
                    } else {
                        let hr = Math.max(radius.b.r,radius.t.r);
                        if (radius.hang && hang_check > 0 && (radius.b.r === 0 || radius.t.r === 0)) {
                            if (hang_check < hr) {
                                r.t.r = hasSummary ? 0 : radius.t.r > 0 ? hr : hang_check; // If there is a summary, set to 0, else if the radius should be greater than 0, set to the max of top and bottom, else set the difference between the two bars (so if one bar overhangs the other by 2 px but the radius is 5px, the radius will be set to 2 px
                                r.b.r = radius.b.r > 0 ? hr : hang_check;
                            } else {
                                r.t.r = hasSummary ? 0 : hr;
                                r.b.r = isSummary ? 0 : hr;
                            }
                        } else {
                            r.t.r = hasSummary ? 0 : radius.t.r;
                            r.b.r = isSummary ? 0 : radius.b.r;
                        }
                    }
                    let top = w - r.t.l - r.t.r // top width = base_width - top radiuses
                        , right = h - r.t.r - r.b.r
                        , bottom = w - r.b.r - r.b.l
                        , left = h - r.b.l - r.t.l
                    // t=top, b=bottom, l=left, r=right, i=inside (between boxes)
                    let path_string = `M${r.t.l},0 
                                        h${top} 
                                        a${r.t.r} ${r.t.r}, 0, 0, 1, ${r.t.r} ${r.t.r} 
                                        v${right} 
                                        a${r.b.r} ${r.b.r}, 0, 0, 1, -${r.b.r} ${r.b.r}  
                                        h-${bottom} 
                                        a${r.b.l} ${r.b.l}, 0, 0, 1, -${r.b.l} -${r.b.l} 
                                        v-${left} 
                                        a${r.t.l} ${r.t.l}, 0, 0, 1, ${r.t.l} -${r.t.l} 
                                        z`
                    return path_string
                }
            }
            methods.resultsPath = pathFactory(methods.calcResultWidth, chart.settings.barRadiusResults, metrics.resultsLastIndex, -metrics.targetGreater, chart.settings.summarizeResults, false);
            methods.targetsPath = pathFactory(methods.calcTargetWidth, chart.settings.barRadiusTargets, metrics.targetsLastIndex, metrics.targetGreater, chart.settings.summarizeTargets, false);

            methods.resultsSummaryPath = pathFactory(methods.calcResultWidth, chart.settings.barRadiusResults, 0, -metrics.targetGreater, false, true);
            methods.targetsSummaryPath = pathFactory(methods.calcTargetWidth, chart.settings.barRadiusTargets, 0, metrics.targetGreater, false, true);


            // Formatting Methods

            /**
             * Generated classes for the targets bars
             * @param d - chartObj
             * @param i - index
             * @return {string}
             */
            methods.targetBarFormat = (d,i) => {
                let return_text = "target s" + i; // Bar Index

                // Width classes, every 25 pixels prepended with w
                let width = methods.calcTargetWidth(d, i);
                for (let i = 0; i <= Math.round(width); i+=chart.settings.w_threshold) {
                    return_text += " w"+`${i}`
                }

                // Target name, human-readable and raw
                return_text += " "+makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }

                if (d.classes && d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return return_text;
            }

             /**
             * Wrapper function to keep the API the same and so custom formatters don't need to call d.value just d
             */
            methods.targetTextLabel = (d, i) => {
                return chart.formatterValue(d.value);
            }

            /**
             * Generated classes for the targets text
             * Generally if you want to target the text, you can just reference the parent SVG classes
             * @param d - chartObj
             * @param i - index
             * @return {string}
             */
            methods.targetTextFormat = (d,i) => {
                let return_text = "target text s" + i;
                return_text += " " + makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                return return_text;
            }

            /**
             * If targets are being summarized, that shifts everything down one barHeight
             * @param d - chartObj
             * @param i - index
             * @return y position
             */
            methods.targetsYPos = (d,i) => {
                let y = 0;
                if (chart.settings.summarizeTargets) {y+=chart.barHeight}
                return y
            }

            /**
             * Generated classes for the results bars
             * @param d - chartObj
             * @param i - index
             * @return {string}
             */
            methods.resultBarFormat = (d,i) => {
                let return_text = "result s" + i; // Bar Index

                // Width classes, every 25 pixels prepended with w
                let width = methods.calcResultWidth(d, i);
                for (let i = 0; i <= Math.round(width) ; i+=chart.settings.w_threshold) {
                    return_text += " w"+`${i}`
                }

                // Percent to target classes, every 10 percent prepended with p
                for (let i = 0; i <= d.percent_to_target; i+=chart.settings.p_threshold) {
                    return_text += " p"+`${Math.round(i*100)}`
                }
                // Call out the last one for easy targeting
                if (i === metrics.resultsLastIndex) {
                    return_text += " last";
                }

                // Target name, human-readable and raw
                return_text += " "+makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }

                if (d.classes && d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return return_text;
            }

            /**
             * Change what text is shown on the bar depending on the size of the results bar.
             *  If the width is less than ~75, don't show the percentage
             * The minimum width at which to show the precentage is a setting: chart.settings.minWidthForPercent
             * @param d - chartObj
             * @param i - index
             * @return {string}
             */
            methods.resultTextLabel = (d, i) => {
                let return_text = chart.formatterValue(d.value);
                let width = methods.calcResultWidth(d, i);
                if (width >= chart.settings.minWidthForPercent) {
                    // Append percentage if there is room
                    return_text += " (" + chart.formatterPercent(d.percent_to_target) + ")";
                }
                return return_text;
            }

            /**
             * If targets are being summarized or targets and results are summarized, that shifts everything down one or two barHeight
             * @param d - chartObj
             * @param i - index
             * @return y position
             */
            methods.resultsYPos = (d,i) => {
                let y = chart.barHeight;
                if (chart.settings.summarizeTargets) {y+=chart.barHeight}
                if (chart.settings.summarizeResults) {y+=chart.barHeight}
                return y
            }

            /**
             * Generated classes for the results text
             * Generally if you want to target the text, you can just reference the parent SVG classes
             * @param d - chartObj
             * @param i - index
             * @return {string}
             */
            methods.resultTextFormat = (d,i) => {
                let return_text = "result text s" + i;
                return_text += " " + makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                return return_text;
            }

            /**
             * Generated classes for the target markers
             * @param d - chartObj
             * @param i - index
             * @return {string}
             */
            methods.targetMarkerFormat = (d, i) => {
                let return_text = "marker s" + i;
                if (d.classes && d.classes.length) {
                    return_text += d.classes.join(" ")
                }
                return_text += " "+makeSafeForCSS(d.column);
                if (d.column !== d.name) {
                    return_text += " " + makeSafeForCSS(d.name);
                }
                return return_text;
              };

            /**
             * Generated classes for the results markers
             * @param d - chartObj
             * @param i - index
             * @return {string}
             */
            methods.resultMarkerFormat = (d, i) => {
                let return_text = "marker s" + i;
                for (let i = 0; i <= d.percent_to_target; i+=chart.settings.p_threshold) {
                    return_text += " p"+`${Math.round(i*100)}`
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

        /**
         * Build all the svg elements for each sub-chart object
         */
        function buildChartObj(chartObj) {
            if (chartObj.link) {
                chartObj.g.node().parentNode.href=chartObj.link;
            }
            chartObj.svg.bars = chartObj.g.append("g").attr("class","bars");
            chartObj.svg.targets = chartObj.svg.bars.append("g").attr("class","targets");

            // Parent target bar svg
            let g = chartObj.svg.targets.selectAll("svg")
                .data(chartObj.metrics.targets)
                .enter()
                .append("svg")
                .attr("class", chartObj.methods.targetBarFormat)
                .attr("width", chartObj.methods.calcTargetWidth)
                .attr("height", chart.barHeight)
                .attr("y", chartObj.methods.targetsYPos)
                .attr("x", chartObj.methods.calcTargetX)

            g.append("path")
                .attr("class", chartObj.methods.targetBarFormat)
                .attr("d", chartObj.methods.targetsPath)

            g.append("text")
                .attr("class", chartObj.methods.targetTextFormat)
                .attr("dy", '.1em')
                .attr("y","50%")
                .attr("x","50%")
                .attr("dominant-baseline","middle")
                .style("text-anchor", "middle")
                .text(function(d, i) {
                    return chartObj.methods.targetTextLabel(d);
                });
            let xtEnd = chartObj.svg.targets.node().getBBox().width + chart.settings.titlePadding;

            chartObj.svg.results = chartObj.svg.bars.append("g").attr("class","results");
            let r = chartObj.svg.results.selectAll("svg")
                .data(chartObj.metrics.results)
                .enter()
                .append("svg")
                .attr("class", chartObj.methods.resultBarFormat)
                .attr("width", chartObj.methods.calcResultWidth)
                .attr("height", chart.barHeight)
                .attr("x", chartObj.methods.calcResultX)
                .attr("y",chartObj.methods.resultsYPos)

            r.append("path")
                .attr("class", chartObj.methods.resultBarFormat)
                .attr("d", chartObj.methods.resultsPath)

            r.append("text")
                .attr("class", chartObj.methods.resultTextFormat)
                .attr("dy", '.1em')
                .attr("y","50%")
                .attr("x","50%")
                .attr("dominant-baseline","middle")
                .attr("text-anchor", "middle")
                .text(function(d, i) {
                    return chartObj.methods.resultTextLabel(d,i);
                });

            // If there is less than 75 pixels at the end of the bar, display the text summary below the bar
            //   otherwise display it at the end of the bar.
            let xEnd = chartObj.svg.results.node().getBBox().width + chart.settings.titlePadding;
            if (xEnd > chart.barWidth - 75) {
                chartObj.svg.results.append("text")
                    .attr("class", "summary")
                    .attr("dy", '.1em')
                    .attr("y", function(d, i) {return (chartObj.methods.resultsYPos(d,i)+chart.barHeight) + 4 }) // Halfway through the second bar (results bar)
                    .attr("x", xEnd)
                    .attr("dominant-baseline", "hanging")
                    .attr("text-anchor", "end")
                    .text(chart.formatterValue(chartObj.metrics.resultsMax) + " (" + chart.formatterPercent(chartObj.metrics.resultsMax / chartObj.metrics.targetsMax) + ")")

            } else {
                chartObj.svg.results.append("text")
                    .attr("class", "summary")
                    .attr("dy", '.1em')
                    .attr("y", function(d, i) {return (chartObj.methods.resultsYPos(d,i)+chart.barHeight/2)}) // Halfway through the second bar (results bar)
                    .attr("x", xEnd + 5)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .text(chart.formatterValue(chartObj.metrics.resultsMax) + " (" + chart.formatterPercent(chartObj.metrics.resultsMax / chartObj.metrics.targetsMax) + ")")
            }

            // Update the marker lines.
           chartObj.svg.targetsMarkers = chartObj.svg.bars.append("g").attr("class","targets-markers");
            let tm = chartObj.svg.targetsMarkers.selectAll("svg")
                .data(chartObj.metrics.targetsMarkers)
                .enter()
                .append("line")
                .attr("class", chartObj.methods.targetMarkerFormat)
                .attr("x1", chartObj.methods.calcTargetMarkerX)
                .attr("x2", chartObj.methods.calcTargetMarkerX)
                .attr("y1", chartObj.methods.targetsYPos)
                .attr("y2", function(d,i) {
                    return chartObj.methods.targetsYPos(d,i)+chart.barHeight
                })

            chartObj.svg.resultsMarkers = chartObj.svg.bars.append("g").attr("class","results-markers");
            let rm = chartObj.svg.resultsMarkers.selectAll("svg")
                .data(chartObj.metrics.resultsMarkers)
                .enter()
                .append("line")
                .attr("class", chartObj.methods.resultMarkerFormat)
                .attr("x1", chartObj.methods.calcResultMarkerX)
                .attr("x2", chartObj.methods.calcResultMarkerX)
                .attr("y1", chartObj.methods.resultsYPos)
                .attr("y2", function(d,i) {
                    return chartObj.methods.resultsYPos(d,i)+chart.barHeight
                })


            // If the summary settings are activated build those boxes
            if (chart.settings.summarizeTargets) {
                chartObj.svg.targetsSummary = chartObj.svg.bars.append("g").attr("class", "targets-summary");
                let ts = chartObj.svg.targetsSummary.append("svg")
                    .attr("class", "summary")
                    .attr("width", xtEnd - chart.settings.titlePadding)
                    .attr("height", chart.barHeight)
                    .attr("x", chart.settings.titlePadding)
                    .attr("y", "0")

                ts.append("path")
                    .attr("class","target summary")
                    .attr("d", function() {return chartObj.methods.targetsSummaryPath({value:chartObj.metrics.targetsMax,name:'targetsSummary'},0)})

                if ((xtEnd - chart.settings.titlePadding) <= chart.settings.minWidthForPercent) {
                    // If the length of the bar won't fit the full percent metrics, put the label at the end
                    chartObj.svg.resultsSummary.append("text")
                        .attr("class", "summary")
                        .attr("dy", '.1em')
                        .attr("y", chart.barHeight * .5)
                        .attr("x", xtEnd + 5)
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "start")
                        .text(chart.formatterValue(chartObj.metrics.targetsMax))
                } else {
                    ts.append("text")
                        .attr("dy", '.1em')
                        .attr("y", "50%")
                        .attr("x", "50%")
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "middle")
                        .text(chart.formatterValue(chartObj.metrics.targetsMax))
                }
            }

            if (chart.settings.summarizeResults) {
                chartObj.svg.resultsSummary = chartObj.svg.bars.append("g").attr("class","results-summary");
                let rs = chartObj.svg.resultsSummary.append("svg")
                    .attr("class", "summary")
                    .attr("width", xEnd - chart.settings.titlePadding)
                    .attr("height", chart.barHeight)
                    .attr("x", chart.settings.titlePadding)
                    .attr("y",function(d,i) {return chartObj.methods.targetsYPos(1,1)+chart.barHeight})

                rs.append("path")
                    .attr("class", "result summary")
                    .attr("d", function() {return chartObj.methods.resultsSummaryPath({value:chartObj.metrics.resultsMax,name:'resultsSummary'},0)})

                if ((xEnd-chart.settings.titlePadding) <= chart.settings.minWidthForPercent) {
                    // If the length of the bar won't fit the full percent metrics, put the label at the end
                    chartObj.svg.resultsSummary.append("text")
                        .attr("class","summary")
                        .attr("dy", '.1em')
                        .attr("y",function(d,i) {return chartObj.methods.targetsYPos(1,1)+(chart.barHeight*1.5)})
                        .attr("x", xEnd+5)
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "start")
                        .text(chart.formatterValue(chartObj.metrics.resultsMax) + " (" + chart.formatterPercent(chartObj.metrics.resultsMax / chartObj.metrics.targetsMax) + ")")
                } else {
                    rs.append("text")
                        .attr("dy", '.1em')
                        .attr("y", "50%")
                        .attr("x", "50%")
                        .attr("dominant-baseline", "middle")
                        .attr("text-anchor", "middle")
                        .text(chart.formatterValue(chartObj.metrics.resultsMax) + " (" + chart.formatterPercent(chartObj.metrics.resultsMax / chartObj.metrics.targetsMax) + ")")
                }
            }

        return chartObj;
        }

        for (const p in chart.groupObjs) {
            chart.groupObjs[p].methods = calcMethods(chart.groupObjs[p].metrics);
            buildChartObj(chart.groupObjs[p]);
        }
    }

    chart.set(settings);

    /**
     * Prepare the chart html elements
     */
    chart.render = function() {
        // Build main div and chart div
        chart.objs.mainDiv = d3.select(chart.settings.selector);
        chart.objs.mainDiv.node().classList.add("pace-chart");

        // Add all the divs to make it centered and responsive
        chart.objs.mainDiv.append("div").attr("class", "inner-box").style("display","flex").style("flex-wrap","wrap");

        // Capture the inner div for the chart (where the chart actually is)
        chart.selector = chart.settings.selector + " .inner-box";
        chart.objs.chartDiv = d3.select(chart.selector);

        // Create the svg
        chart.objs.g = chart.objs.chartDiv.selectAll("div.chart-area")
            .data(chart.data)
            .enter()
            .append("div")
            .attr("class", "group chart-area")

        if (chart.settings.linkCol) {
            chart.objs.g = chart.objs.g
                .append("a")
                .attr("target","_blank")
                .attr("rel","noreferrer noopener")
        }
        chart.objs.g = chart.objs.g
            .append("svg")
            .attr("width", chart.width)
            .attr("height", chart.height);

        chart.objs.titles = chart.objs.g.append("g")
            .style("text-anchor", "end")
            .attr("class", "titles")

        chart.objs.titles.append("text")
            .attr("class", "title")
            .attr("x",chart.settings.titlePadding-5)
            .attr("y",(chart.barHeight * (2 + chart.settings.summarizeTargets + chart.settings.summarizeResults))/2)
            .text(function(d) {
                return d[chart.settings.titleCols[0]];
            });

        chart.objs.titles.append("text")
            .attr("class", "subtitle")
            .attr("dy", "1em")
            .attr("x",chart.settings.titlePadding-5)
            .attr("y",(chart.barHeight * (2 + chart.settings.summarizeTargets + chart.settings.summarizeResults))/2)
            .text(function(d) {
                return d[chart.settings.titleCols[1]];
            });

        // Create tooltip div
        chart.objs.tooltip = chart.objs.mainDiv.append('div').attr('class', 'tooltip');

        // Create each chart divs
        chart.objs.g.each(
            function(g,i) {
                for (let unique_id in chart.groupObjs) {
                    if (unique_id === g['unique_id']) {
                        // To make the dom elements easier to reference, add them to the chartObjects object
                        chart.groupObjs[unique_id].g = d3.select(this)
                        chart.groupObjs[unique_id].g.attr("class", makeSafeForCSS(chart.groupObjs[unique_id].title) + " " + makeSafeForCSS(chart.groupObjs[unique_id].subtitle));
                        chart.groupObjs[unique_id].g.attr("id", chart.groupObjs[unique_id].unique_id);
                        // Add the mouseover
                        chart.groupObjs[unique_id].g.on("mouseover", function (event, d) {
                            chart.objs.tooltip
                                .style("display", null)
                                .style("left", (event.pageX) + "px")
                                .style("top", (event.pageY - 28) + "px");
                        }).on("mouseout", function () {
                            chart.objs.tooltip.style("display", "none");
                        }).on("mousemove", function (event, d) {
                            chart.objs.tooltip
                                .style("left", (event.pageX + 10) + "px")
                                .style("top", (event.pageY - 10) + "px");
                            tooltipRender(chart.groupObjs[unique_id], event.target.__data__)()
                        })
                    }
                }
            }
        );

        chart.update();
        return chart;
    };

    return chart;
}
