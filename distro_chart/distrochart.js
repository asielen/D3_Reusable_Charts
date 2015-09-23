function makeDistroChart(dataset, xGroup, yValue) {
    /*
    * dataset = the csv file
    * xGroup = the name of the column to group by
    * yValue = the column to use as the values for the chart
    * axisLabels = Labels for the chart
    * options = list of chart options
    *   scale = linear (vs log)
    *   chartSize
    *   – chart_width = 650
    *   – chart_height = 480
    *   – ratio = chart_height/chart_width <– this is the actual number used in the
    *   margin = {top: 15, right: 60, bottom: 30, left: 50};
    *
    * */

    var chartObj = {};

    var colorFunct =  d3.scale.category10(); //function () {return 'lightgrey';};

    function formatAsFloat(d) {
        if (d % 1 !== 0) {
            return d3.format(".2f")(d);
        } else {
            return d3.format(".0f")(d);
        }

    }
    function logFormatNumber (d) {
        var x = Math.log(d) / Math.log(10) + 1e-6;
        return Math.abs(x - Math.floor(x)) < 0.6 ? formatAsFloat(d) : "";
    }
    chartObj.yFormatter = formatAsFloat;

    chartObj.data = dataset;
    chartObj.svg = null;

    //Data management
    chartObj.xGroup = xGroup;
    chartObj.yValue = yValue;
    chartObj.dataObjects = {}; //The data organized by grouping and sorted as well as any metadata for the groups

    function calcMetrics(values){

            var metrics = { //These are the original non–scaled values
                    max: null,
                    upperOuterFence: null,
                    upperInnerFence: null,
                    quartile3: null,
                    median: null,
                    mean: null,
                    iqr: null,
                    quartile1: null,
                    lowerInnerFence: null,
                    lowerOuterFence: null,
                    min: null
                };
            metrics.min = d3.min(values);
            metrics.quartile1 = d3.quantile(values, 0.25);
            metrics.median = d3.median(values);
            metrics.mean = d3.mean(values);
            metrics.quartile3 = d3.quantile(values, 0.75);
            metrics.max = d3.max(values);

            metrics.iqr = metrics.quartile3 - metrics.quartile1;

            //The inner fences are the closest value to the IQR without going past it (assumes sorted lists)
            var LIF = metrics.quartile1 - (1.5 * metrics.iqr);
            var UIF = metrics.quartile3 + (1.5 * metrics.iqr);
            for (var i = 0; i <= values.length; i++) {
                if (values[i] < LIF) {continue;}
                if (!metrics.lowerInnerFence && values[i] >= LIF) {
                    metrics.lowerInnerFence = values[i];
                    continue;
                }
                if (values[i] > UIF) {
                    metrics.upperInnerFence = values[i - 1];
                    break;
                }
            }

            metrics.lowerOuterFence = metrics.quartile1 - (3 * metrics.iqr);
            metrics.upperOuterFence = metrics.quartile3 + (3 * metrics.iqr);
            if (!metrics.lowerInnerFence) {metrics.lowerInnerFence = metrics.min;}
            if (!metrics.upperInnerFence) {metrics.upperInnerFence = metrics.max;}
            return metrics
        }

    (function () {
        /*
        * Takes the dataset that is an array of objects and groups the yValues by xGroups and then sorts it
        * Returns the dataObject
        * */
        var current_x = null;
        var current_y = null;
        var current_row;

        //Group the values
        for (current_row = 0; current_row < chartObj.data.length; current_row++) {
            current_x = chartObj.data[current_row][chartObj.xGroup];
            current_y = chartObj.data[current_row][chartObj.yValue];
            if (chartObj.dataObjects.hasOwnProperty(current_x)) {
                chartObj.dataObjects[current_x].values.push(current_y);
            } else {
                chartObj.dataObjects[current_x] = {};
                chartObj.dataObjects[current_x].values = [current_y];
            }
        }

        var cName;
        // Sort them
        for  (cName in chartObj.dataObjects) {
            chartObj.dataObjects[cName].values.sort(d3.ascending);
            chartObj.dataObjects[cName].metrics = {};
            chartObj.dataObjects[cName].metrics = calcMetrics(chartObj.dataObjects[cName].values);

        }


    })();

    function updateColorFunction (colorOptions){
        if (typeof colorOptions == 'function') {
            return colorOptions
        } else if (Array.isArray(colorOptions)) {
            //  If an array is provided, map it to the domain
            var colorMap = {}, cColor = 0;
            for (var cName in chartObj.dataObjects) {
                colorMap[cName] = colorOptions[cColor];
                cColor = (cColor + 1) % colorOptions.length;
            }
            return function (group) {return colorMap[group];}
        } else if (typeof colorOptions == 'object') {
            // if an object is provided, assume it maps to  the colors
            return function (group) {return colorOptions[group];}
        }
    }

    chartObj.updateChart = function () {
        //Base
        if (!chartObj.svg) {return false;}
        // Update size
        chartObj.width = parseInt(chartObj.chartDiv.style("width"), 10) - (chartObj.margin.left + chartObj.margin.right);
        chartObj.height = parseInt(chartObj.chartDiv.style("height"), 10) - (chartObj.margin.top + chartObj.margin.bottom);
        chartObj.xScale.rangeBands([0, chartObj.width]);
        chartObj.yScale.range([chartObj.height, 0]);
        //Updae axes
        chartObj.svg.select('.x.axis').attr("transform", "translate(0," + chartObj.height + ")").call(chartObj.xAxis)
            .selectAll("text")
            .attr("y",5)
            .attr("x",-5)
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");;
        chartObj.svg.select('.x.axis .label').attr("x", chartObj.width / 2);
        chartObj.svg.select('.y.axis').call(chartObj.yAxis);
        chartObj.svg.select('.y.axis .label').attr("x", -chartObj.height / 2);
        chartObj.chartDiv.select('svg').attr("width", chartObj.width + (chartObj.margin.left + chartObj.margin.right)).attr("height", chartObj.height + (chartObj.margin.top + chartObj.margin.bottom));

        return chartObj;
    };

    chartObj.bind = function (selector, options) {
        /*
        * Setup chart and connect it to the correct div
        *  – Selector is the id to attach the chart to
        *  – chartSize is height and width of the div
        *  – margin is the margins around the div
        *  Todo: legend options or data labels
        *  - showLegend True/False
        *  - showXLables True/False
        *  - colors, takes a list of hex values or a function and uses it for the color function
        *  - constrainExtremes True/False, if true max is then the max of the lower fences
         */

        //Get base data
        (function(){
            if (options && options.margin) {
                chartObj.margin = margin;
            } else {
                chartObj.margin = {top: 15, right: 20, bottom: 35, left: 50};
            }
            if (options && options.chartSize) {
                chartObj.divWidth = chartSize.width;
                chartObj.divHeight = chartSize.height;
            } else {
                chartObj.divWidth = 800;
                chartObj.divHeight = 600;
            }

            chartObj.width = chartObj.divWidth - chartObj.margin.left - chartObj.margin.right;
            chartObj.height = chartObj.divHeight - chartObj.margin.top - chartObj.margin.bottom;

            if (options && options.axisLabels) {
                chartObj.xAxisLable = axisLabels.xAxis;
                chartObj.yAxisLable = axisLabels.yAxis;
            } else {
                chartObj.xAxisLable = xGroup;
                chartObj.yAxisLable = yValue;
            }
            if (options && options.scale === 'log') {
                chartObj.yScale = d3.scale.log();
                chartObj.yFormatter = logFormatNumber;
            } else {
                chartObj.yScale = d3.scale.linear();
            }

            if (options && options.constrainExtremes === true) {
                var fences = [];
                for (var cName in chartObj.dataObjects) {
                    fences.push(chartObj.dataObjects[cName].metrics.lowerInnerFence);
                    fences.push(chartObj.dataObjects[cName].metrics.upperInnerFence);
                }
                chartObj.range = d3.extent(fences);

            } else {
                chartObj.range = d3.extent(chartObj.data, function (d) {return d[chartObj.yValue];});
            }

            // Take the options colors argument and update the colors function
            if (options && options.colors) {
                colorFunct = updateColorFunction(options.colors);
            }


            chartObj.yScale.range([chartObj.height, 0]).domain(chartObj.range).clamp(true);
            // Get x range
            chartObj.xScale = d3.scale.ordinal().domain(Object.keys(chartObj.dataObjects)).rangeBands([0, chartObj.width]);
            //Build Axes
            chartObj.yAxis = d3.svg.axis()
                .scale(chartObj.yScale)
                .orient("left")
                .tickFormat(chartObj.yFormatter)
                .tickSize(0);
            chartObj.xAxis = d3.svg.axis().scale(chartObj.xScale).orient("bottom");

        })();

        // Capture the main div for the chart
        chartObj.mainDiv = d3.select(selector);
        // Add all the divs to make it centered and responsive
        chartObj.mainDiv.append("div").attr("class", "inner-wrapper").append("div").attr("class", "outer-box").append("div").attr("class", "inner-box");
        // Capture the inner div for the chart (where the chart actually is)
        chartObj.chartSelector = selector + " .inner-box";
        chartObj.chartDiv = d3.select(chartObj.chartSelector);
        d3.select(window).on('resize.' + chartObj.chartSelector, chartObj.updateChart);

        // Create the svg
        chartObj.svg = chartObj.chartDiv.append("svg")
            .attr("class", "chart-area")
            .attr("width", chartObj.width + (chartObj.margin.left + chartObj.margin.right))
            .attr("height", chartObj.height + (chartObj.margin.top + chartObj.margin.bottom))
            .append("g")
                .attr("transform", "translate(" + chartObj.margin.left + "," + chartObj.margin.top + ")");

        // Show axis
        chartObj.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + chartObj.height + ")")
            .call(chartObj.xAxis);



        chartObj.svg.append("g")
            .attr("class", "y axis")
            .call(chartObj.yAxis)
            .append("text")
                .attr("class", "label")
                .attr("transform", "rotate(-90)")
                .attr("y", -42)
                .attr("x", -chartObj.height / 2)
                .attr("dy", ".71em")
                .style("text-anchor", "middle")
                .text(chartObj.yAxisLable);

        // Create legend
        //var legend = chartObj.mainDiv.append('div').attr("class", "legend");
        //var cGroup, series;
        //for (cGroup in chartObj.dataObjects) {
        //    series = legend.append('div').style("width",136+"px");
        //    series.append('div').attr("class", "series-marker").style("background-color", color(cGroup));
        //    series.append('p').text(cGroup);
        //    chartObj.dataObjects[cGroup].legend = series;
        //}
        chartObj.updateChart();

        return chartObj;
    };

    chartObj.updateBoxSize = function(boxWidth) {
            var boxSize = {left:null, right:null, middle:null};
            var width = chartObj.xScale.rangeBand() * (boxWidth/100);
            var padding = (chartObj.xScale.rangeBand()-width)/2;
            boxSize.middle = chartObj.xScale.rangeBand()/2;
            boxSize.left = padding;
            boxSize.right = boxSize.left+width;
            return boxSize;
    };

    chartObj.renderViolinPlot = function(options) {
        /*
        * Possible
        *  - resolution, number of bins
        *  - widthMuliplier (wider or not)
        *  - plot points (tbd)
        *  - showBuckets True/False (instead of smooth, have steps)
        *
         */
        chartObj.violinPlots = {};
        chartObj.violinPlots.plots = {};

        // Violin Calculations
        chartObj.violinPlots.calculateNumBins = function(cGroup){
            var iqr;
            if (chartObj.boxPlots) {
                iqr = chartObj.dataObjects[cGroup].metrics.iqr
            } else {
                var quartile1 = d3.quantile(chartObj.dataObjects[cGroup].values, 0.25);
                var quartile3 = d3.quantile(chartObj.dataObjects[cGroup].values, 0.75);
                iqr = quartile3 - quartile1;
            }
            return Math.max(Math.round(2 * (iqr / Math.pow(chartObj.dataObjects[cGroup].values.length,1/3))),50)
        };

        function prepareViolin() {
            /*
             * Takes the structured data and calculates the box plot numbers
             * */

            var cName;
            for (cName in chartObj.dataObjects) {
                chartObj.dataObjects[cName].violin = {};
                chartObj.dataObjects[cName].violin.objs = {};
                chartObj.dataObjects[cName].violin.histogramData = d3.layout.histogram()
                    .bins(chartObj.violinPlots.calculateNumBins(cName))
                    .frequency(1)(chartObj.dataObjects[cName].values);
            }

            if (options && options.colors) {
                chartObj.violinPlots.color = updateColorFunction(options.colors);
            } else {
                chartObj.violinPlots.color = colorFunct
            }
        }
        prepareViolin();

        chartObj.violinPlots.updateChart = function () {
            var cName, cViolinPlot;

            for (cName in chartObj.dataObjects) {
                cViolinPlot = chartObj.dataObjects[cName].violin;

                // Get the box size
                var boxSize = {left:null, right:null, middle:null};
                if (options && options.boxWidth) {
                    boxSize = chartObj.updateBoxSize(options.boxWidth)
                } else {
                    boxSize = chartObj.updateBoxSize(100)
                }
                var leftBound = chartObj.xScale(cName) + boxSize.left;
                var rightBound = chartObj.xScale(cName) + boxSize.right;
                var width = (rightBound-leftBound)/2;

                var xV = chartObj.yScale.copy();
                var yV = d3.scale.linear()
                    .range([width, 0])
                    .domain([0, Math.max(chartObj.range[1], d3.max(cViolinPlot.histogramData, function(d) { return d.y; }))])
                    .clamp(true);
                var area = d3.svg.area()
                    .interpolate('basis')
                    .x(function(d) { return xV(d.x);}) //Clips the  function above the chart max
                    .y0(width)
                    .y1(function(d) { return yV(d.y);});

                var line = d3.svg.line()
                    .interpolate('basis')
                    .x(function(d) { return xV(d.x);})
                    .y(function(d) { return yV(d.y);});

                cViolinPlot.objs.left.area
                  .datum(cViolinPlot.histogramData)
                  .attr("d", area);

                cViolinPlot.objs.left.line
                  .datum(cViolinPlot.histogramData)
                  .attr("d", line);

                cViolinPlot.objs.right.area
                  .datum(cViolinPlot.histogramData)
                  .attr("d", area);

                cViolinPlot.objs.right.line
                  .datum(cViolinPlot.histogramData)
                  .attr("d", line);

                cViolinPlot.objs.left.g.attr("transform", "rotate(90,0,0)   translate(0,-"+leftBound+")  scale(1,-1)");
                cViolinPlot.objs.right.g.attr("transform", "rotate(90,0,0)  translate(0,-"+rightBound+")");
        }};

        function mapObjects () {

            var cName, cViolinPlot;

            for (cName in chartObj.dataObjects) {
                cViolinPlot = chartObj.dataObjects[cName].violin;

                cViolinPlot.g = chartObj.svg.append("g").attr("class","violin");
                cViolinPlot.objs.left = {area:null, line:null, g:null};
                cViolinPlot.objs.right = {area:null, line:null, g:null};

                cViolinPlot.objs.left.g = cViolinPlot.g.append("g");
                cViolinPlot.objs.left.area = cViolinPlot.objs.left.g.append("path")
                    .attr("class", "area")
                    .style("fill", chartObj.violinPlots.color(cName));

                cViolinPlot.objs.left.line = cViolinPlot.objs.left.g.append("path")
                    .attr("class", "violin")
                    .attr("fill", 'none')
                    .style("stroke", chartObj.violinPlots.color(cName));

                cViolinPlot.objs.right.g = cViolinPlot.g.append("g");
                cViolinPlot.objs.right.area = cViolinPlot.objs.right.g.append("path")
                    .attr("class", "area")
                    .style("fill", chartObj.violinPlots.color(cName));

                cViolinPlot.objs.right.line = cViolinPlot.objs.right.g.append("path")
                    .attr("class", "violin")
                    .attr("fill", 'none')
                    .style("stroke", chartObj.violinPlots.color(cName));
            }
        }
        mapObjects();

        d3.select(window).on('resize.' + chartObj.chartSelector+'.violinPlot', chartObj.violinPlots.updateChart);
        //Update the divs with the proper values
        chartObj.violinPlots.updateChart();
        return chartObj.violinPlots;
    };

    chartObj.renderBoxPlot = function(options) {
        chartObj.boxPlots = {};
        /*
         * options:
         *   showOutliers: True/False (default True) - this shouldn't  affect the min/max
         *   showWhiskers: True/False (default True)
         *   whiskersRatio: (default standard=iqr*1.5), other options, minmax, (future?: std)
         *   showBox: True/False (default True)
         *   showMedian: True/False  (default True)
         *   showMean: True/False (default False)
         *   outlierScatter: True/False (default False) (not fully implimented)
         *   boxWidth (not implimented) what percent of the bin should the box take up
         */

        //Create boxPlots
        for (var cName in chartObj.dataObjects) {
            chartObj.dataObjects[cName].boxPlot = {};
            chartObj.dataObjects[cName].boxPlot.objs = {};
        }
        function calcOutliers(obj, values, metrics) {
            /*
             * Create lists of the outliers for each content group
             */

            var cExtremes = [];
            var cOutliers = [];
            var cOut, idx;
            for (idx = 0; idx <= values.length; idx++) {
                cOut = {value: values[idx]};

                if (cOut.value < metrics.lowerInnerFence) {
                    if (cOut.value < metrics.lowerOuterFence) {
                        cExtremes.push(cOut);
                    } else {
                        cOutliers.push(cOut);
                    }
                } else if (cOut.value > metrics.upperInnerFence) {
                    if (cOut.value > metrics.upperOuterFence) {
                        cExtremes.push(cOut);
                    } else {
                        cOutliers.push(cOut);
                    }
                }
            }
            obj.outliers = cOutliers;
            obj.extremes = cExtremes;
        }

        if (!options || (options && options.showOutliers !== false)) {
            for (var cName in chartObj.dataObjects) {
                calcOutliers(chartObj.dataObjects[cName].boxPlot.objs, chartObj.dataObjects[cName].values, chartObj.dataObjects[cName].metrics);
            }
        }

        if (options && options.colors) {
            chartObj.boxPlots.colorFunct = updateColorFunction(options.colors);
        } else {
            chartObj.boxPlots.colorFunct = colorFunct
        }


        chartObj.boxPlots.updateChart = function () {
            //Boxplot
            var cName, cBoxPlot;
            for (cName in chartObj.dataObjects) {
                cBoxPlot = chartObj.dataObjects[cName].boxPlot;

                // Get the box size
                var boxSize = {left: null, right: null, middle: null};
                if (options && options.boxWidth) {
                    boxSize = chartObj.updateBoxSize(options.boxWidth)
                } else {
                    boxSize = chartObj.updateBoxSize(30)
                }
                var leftBound = chartObj.xScale(cName) + boxSize.left;
                var rightBound = chartObj.xScale(cName) + boxSize.right;
                var middle = chartObj.xScale(cName) + boxSize.middle;

                var sMetrics = {}; //temp var for scaled (plottable) metric values
                for (var attr in chartObj.dataObjects[cName].metrics) {
                    sMetrics[attr] = null;
                    sMetrics[attr] = chartObj.yScale(chartObj.dataObjects[cName].metrics[attr]);

                }

                //// Box
                if (cBoxPlot.objs.box) {
                    cBoxPlot.objs.box
                        .attr("x", leftBound)
                        .attr('width', rightBound - leftBound)
                        .attr("y", sMetrics.quartile3)
                        .attr("rx", 1)
                        .attr("ry", 1)
                        .attr("height", -sMetrics.quartile3 + sMetrics.quartile1)
                }
                //// Lines
                if (cBoxPlot.objs.upperWhisker) {
                    cBoxPlot.objs.upperWhisker.fence
                        .attr("x1", leftBound)
                        .attr("x2", rightBound)
                        .attr('y1', sMetrics.upperInnerFence)
                        .attr("y2", sMetrics.upperInnerFence);
                    cBoxPlot.objs.upperWhisker.line
                        .attr("x1", middle)
                        .attr("x2", middle)
                        .attr('y1', sMetrics.quartile3)
                        .attr("y2", sMetrics.upperInnerFence);

                    cBoxPlot.objs.lowerWhisker.fence
                        .attr("x1", leftBound)
                        .attr("x2", rightBound)
                        .attr('y1', sMetrics.lowerInnerFence)
                        .attr("y2", sMetrics.lowerInnerFence);
                    cBoxPlot.objs.lowerWhisker.line
                        .attr("x1", middle)
                        .attr("x2", middle)
                        .attr('y1', sMetrics.quartile1)
                        .attr("y2", sMetrics.lowerInnerFence);
                }
                //// Median
                if (cBoxPlot.objs.median) {
                    cBoxPlot.objs.median.line
                        .attr("x1", leftBound)
                        .attr("x2", rightBound)
                        .attr('y1', sMetrics.median)
                        .attr("y2", sMetrics.median);
                    cBoxPlot.objs.median.circle
                        .attr("cx", middle)
                        .attr("cy", sMetrics.median)
                }

                //// Mean
                if (cBoxPlot.objs.mean) {
                    cBoxPlot.objs.mean.line
                        .attr("x1", leftBound)
                        .attr("x2", rightBound)
                        .attr('y1', sMetrics.mean)
                        .attr("y2", sMetrics.mean);
                    cBoxPlot.objs.mean.circle
                        .attr("cx", middle)
                        .attr("cy", sMetrics.mean);
                }
                //// Outliers
                var pt;
                if (cBoxPlot.objs.outliers) {
                    for (pt in cBoxPlot.objs.outliers) {
                        cBoxPlot.objs.outliers[pt].point
                            .attr("cx", middle/*+scatter()*/)
                            .attr("cy", chartObj.yScale(cBoxPlot.objs.outliers[pt].value));
                    }
                }
                if (cBoxPlot.objs.extremes) {
                    for (pt in cBoxPlot.objs.extremes) {
                        cBoxPlot.objs.extremes[pt].point
                            .attr("cx", middle/*+scatter()*/)
                            .attr("cy", chartObj.yScale(cBoxPlot.objs.extremes[pt].value));
                    }
                }
            }
        };
        chartObj.boxPlots.tooltip = chartObj.mainDiv.append('div').attr('class', 'tooltip').style("opacity", 0);
        // Map everything to divs
        var cName, cBoxPlot;
        for (cName in  chartObj.dataObjects) {
            cBoxPlot = chartObj.dataObjects[cName].boxPlot;

            cBoxPlot.objs.g = chartObj.svg.append("g").attr("class", "boxplot");

            //Plot Box (default show)
            if (!options || (options && options.showBox !== false)) {
                cBoxPlot.objs.box = cBoxPlot.objs.g.append("rect")
                    .attr("class", "boxplot fill")
                    .style("fill", chartObj.boxPlots.colorFunct(cName));
            }

            //Plot Median (default show)
            if (!options || (options && options.showMedian !== false)) {
                cBoxPlot.objs.median = {line: null, circle: null};
                cBoxPlot.objs.median.line = cBoxPlot.objs.g.append("line")
                    .attr("class", "median");
                cBoxPlot.objs.median.circle = cBoxPlot.objs.g.append("circle")
                    .attr("class", "median")
                    .attr('r', 3)
                    .style("fill", chartObj.boxPlots.colorFunct(cName));
            }

            // Plot Mean (default no plot)
            if (options && options.showMean) {
                cBoxPlot.objs.mean = {line: null, circle: null};
                cBoxPlot.objs.mean.line = cBoxPlot.objs.g.append("line")
                    .attr("class", "mean");
                cBoxPlot.objs.mean.circle = cBoxPlot.objs.g.append("circle")
                    .attr("class", "mean")
                    .attr('r', 3)
                    .style("fill", chartObj.boxPlots.colorFunct(cName));
            }

            //Plot Whiskers (default show)
            if (!options || (options && options.showWhiskers !== false)) {
                cBoxPlot.objs.upperWhisker = {fence: null, line: null};
                cBoxPlot.objs.lowerWhisker = {fence: null, line: null};
                cBoxPlot.objs.upperWhisker.fence = cBoxPlot.objs.g.append("line")
                    .attr("class", "upper whisker")
                    .style("stroke", chartObj.boxPlots.colorFunct(cName));
                cBoxPlot.objs.upperWhisker.line = cBoxPlot.objs.g.append("line")
                    .attr("class", "upper whisker")
                    .style("stroke", chartObj.boxPlots.colorFunct(cName));

                cBoxPlot.objs.lowerWhisker.fence = cBoxPlot.objs.g.append("line")
                    .attr("class", "lower whisker")
                    .style("stroke", chartObj.boxPlots.colorFunct(cName));
                cBoxPlot.objs.lowerWhisker.line = cBoxPlot.objs.g.append("line")
                    .attr("class", "lower whisker")
                    .style("stroke", chartObj.boxPlots.colorFunct(cName));
            }

            // Plot outliers (default show)
            //var scatter = function() {
            //    var range = chartObj.xScale.rangeBand()/3;
            //    return Math.floor(Math.random() * range)-range/2;
            //}
            if (!options || (options && options.showOutliers !== false)) {

                var pt;
                if (cBoxPlot.objs.outliers.length) {
                    var outDiv = cBoxPlot.objs.g.append("g").attr("class", "boxplot outliers");
                    for (pt in cBoxPlot.objs.outliers) {
                        cBoxPlot.objs.outliers[pt].point = outDiv.append("circle")
                            .attr("class", "outlier")
                            .attr('r', 2)
                            .style("fill", chartObj.boxPlots.colorFunct(cName));
                    }
                }

                if (cBoxPlot.objs.extremes.length) {
                    var extDiv = cBoxPlot.objs.g.append("g").attr("class", "boxplot extremes");
                    for (pt in cBoxPlot.objs.extremes) {
                        cBoxPlot.objs.extremes[pt].point = extDiv.append("circle")
                            .attr("class", "extreme")
                            .attr('r', 2)
                            .style("stroke", chartObj.boxPlots.colorFunct(cName));
                    }
                }
            }
            function move(name, metrics) {
                var tooltipString = "Group: " + name;
                tooltipString += "<br\>Max: "+formatAsFloat(metrics.max,0.1);
                tooltipString += "<br\>Q3: "+formatAsFloat(metrics.quartile3);
                tooltipString += "<br\>Median: "+formatAsFloat(metrics.median);
                tooltipString += "<br\>Q1: "+formatAsFloat(metrics.quartile1);
                tooltipString += "<br\>Min: "+formatAsFloat(metrics.min);
                return function (){
                    chartObj.boxPlots.tooltip.transition().duration(200).style("opacity", 0.9);
                    chartObj.boxPlots.tooltip.html(tooltipString)
                };
            }

            //Add mouseover
            cBoxPlot.objs.g.on("mouseover", function () {
                chartObj.boxPlots.tooltip.style("display", null);
            }).on("mouseout", function () {
                chartObj.boxPlots.tooltip.style("display", "none");
            }).on("mousemove", move(cName, chartObj.dataObjects[cName].metrics))

        }

        d3.select(window).on('resize.' + chartObj.chartSelector + '.boxPlot', chartObj.boxPlots.updateChart);
        //Update the divs with the proper values
        chartObj.boxPlots.updateChart();

        return chartObj.boxPlots;

    };

    return chartObj;
}
