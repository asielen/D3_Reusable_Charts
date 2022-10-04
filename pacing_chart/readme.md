A reusable and configurable chart to track performance against targets. Based on the common bullet chart, this simplified presentation is easily digestible for presentations and regular kpi updates.

Features:

* Flexibly track multiple breakdowns of targets and results
* Colors and lables are easily styled in CSS
* Supports multiple charts rendered in flexbox for easy layout
* Built for reusability based on the concept outlined in Mike Bostocks blog post [Towards Reusable Charts.](http://bost.ocks.org/mike/chart/) 

Supports D3 v6 and v7

## Installation

1. Host pacingchart.js, pacingchart-base.css (optional), pacingchart-starter.css (optional)
2. Install d3 or reference it through the cdn in your html head:
 eg:  <script src="https://d3js.org/d3.v6.min.js"></script>
3. Add to your html head:
  <script src="pacingchart.js" charset="utf-8"></script>
  <link rel="stylesheet" type="text/css" href="pacingchart-base.css"> 
  <link rel="stylesheet" type="text/css" href="demos/pacingchart-starter.css">

The two css files are optional however, the charts will look very dull without some styling to start. 
pacingchart-base.css 
pacingchart-starter.css Is a good template to start tweaking your own styles

4. Prepare your data (see below)
5. Initialize the charts (see below)

## Preparing your Data
- Data must be formatted as a map prior to passing it to the constructor. See the included example for how to load data from a csv and prepare it for the chart. 

Each row of data creates a single subchart. There is no limit on the number of subcharts that you can render at once. Each one will be treated as a flex-box div within a parent flexbox div for all the subcharts.

Required columns
- A few column types are required:
  - At least one Title Column (must be unique)
  - At least one Targets Column
  - At least one Results Column

NOTE: There is no required naming for the columns, they can be named anything you wish, and you can also include a human-readable name when loading the data.

Optional columns:
- Subtitle column, optional secondary classification for each subchart.
- You can have any number of target columns and results columns, but generally it is best to stick to no more than 4 if not fewer. 
- You can also specify any number of target markers and results markers, these are rendered as lines on the targets and results bars. 


## Configuring the chart
The makePacingChart() function takes an object map. The following data is required:

- **data** - The data map as outlined in the first section
- **selector** - STRING - The css selector for where the charts should be created
- **titleCols** - ARRAY - At least one **Column Name/Key** to be used as the identifier for each subchart. *This is not the value of the columns but just the key/column name used to lookup the title values*. 
  - You can also include a second **Column Name** in this array. That will be used as a subtitle. *Any additional values are ignored.
- **targetsCols** - ARRAY - At least one **Column Name/Key** to be used to identify the targets. 
  - You can also supply a human-readible version of the identifier that can be used in the tool tip. `For example: targetCols = [["col1","Initial Target"],["col2","Final Target"]]` 
  - *If no human-readable form is provided, the provided key will be used for the tooltip. 
- **resultsCols** - ARRAY - At least one **Column Name/Key** to be used to identify the results.
  - Like targetsCols, this also supports a human-readable string. 
- **targetsMarkersCols** - ARRAY - At least one **Column Name/Key** to be used to identify the target markers. Can be null.
  - Like targetsCols, this also supports a human-readable string. 
- **resultsMarkersCols** - ARRAY - At least one **Column Name/Key** to be used to identify the target markers. Can be null.
  - Like targetsCols, this also supports a human-readable string. 

Formatting options:
- **chartWidth** - Default: 500 - How wide in pixels should the subcharts be. This includes padding and titles.
- **barHeight** - Default: 35 - How tall in pixels should each bar be. Note, at a minimum each subchart is 2x this number (35px for targets + 35px for results). Up to 4x this number depending on other options. 
- **titlePadding** - Default: 100 - How much space should be allocated for the title for each chart in pixels.
        lowerSummaryPadding: 20,
        minWidthForPercent: 100,

## Templatizing Settings using Chart.set({settings})
If rendering multiple charts from similar data, you can templatize the settings to keep the initialization cleaner. Using the "set" method allows you to update any chart settings after initialization.

Example - Without settings template:
```javascript
let chart_1 = makePacingChart({
          data:dataset1,
          selector: '#chart-pacing-1',
          targetsCols: [['RED_THRESHOLD','Red'],['YELLOW_THRESHOLD','Yellow'],'TARGET'],
          targetsMarkersCols: ['PREV_PROJECTED_AMOUNT'],
          resultsCols: ['AMOUNT', ['PROJECTED_AMOUNT','Projected'],'FINAL_PROJECTED_AMOUNT'],
          resultMarkersCols: ['PREV_AMOUNT'],
          titleCols: ['Type'], 
        }).render();
let chart_2 = makePacingChart({
          data:dataset2,
          selector: '#chart-pacing-2',
          targetsCols: [['RED_THRESHOLD','Red'],['YELLOW_THRESHOLD','Yellow'],'TARGET'],
          targetsMarkersCols: ['PREV_PROJECTED_AMOUNT'],
          resultsCols: ['AMOUNT', ['PROJECTED_AMOUNT','Projected'],'FINAL_PROJECTED_AMOUNT'],
          resultMarkersCols: ['PREV_AMOUNT'],
          titleCols: ['Type'], 
        }).render();
```
Example - With Template Settings:
```javascript
let settings = {
        targetsCols: [['RED_THRESHOLD','Red'],['YELLOW_THRESHOLD','Yellow'],'TARGET'],
        targetsMarkersCols: ['PREV_PROJECTED_AMOUNT'],
        resultsCols: ['AMOUNT', ['PROJECTED_AMOUNT','Projected'],'FINAL_PROJECTED_AMOUNT'],
        resultMarkersCols: ['PREV_AMOUNT'],
        titleCols: ['Type'] 
}
let chart_1 = makePacingChart(settings)
        .set({data:dataset1,selector:'#chart-pacing-1'})
        .render();
let chart_2 = makePacingChart(settings)
        .set({data:dataset2,selector:'#chart-pacing-2'})
        .render();
```
_Any of the settings parameters can be updated and functions modified (see the tooltips and formatting sections) up until render() is called._


## CSS configuration
Almost every element of these charts can be styled using css. 

Classes: 
- Subcharts are tagged with the title and subtitle of the subchart
- Each subchart is also given a semi-random id
- Metrics are tagged with their kind: target, result, marker
- Every target, result, and marker is tagged with both the column name and also display name of the metric. _NOTE: names that are not "css safe" are converted. Spaces are turned into underscores, underscores are turned into hyphens. Non-ascii elements are removed._
- Targets and result bars are tagged with their width rounded to the nearest 25 pixels. Can be set to different amounts using the w_threshold setting.
  - This is useful for styling bars based on their width or hiding text if the bars are too small
- Results bars and markers are tagged with their percentage of total target to the nearest 10%. Can be set to different amounts using the p_threshold setting.
  - This is useful for styling bars based on their percent to goal. Such as coloring everything under 50% red

Example:
```html
<svg class="performance fy23q3" id="g0-09bdc25fd13fb">
    // classes match title + subtitle
    <g>
        <text class="title">Performance</text>
        <text class="subtitle">FY23Q3</text>
    </g>
    <g class="targets">
        // Object types are organized into their own <g> elements
        <svg class="target s0 w0 w25 w50 w75 w100 w125 w150 w175 w200 w225 red-threshold red">
            <rect class="target s0 w0 w25 w50 w75 w100 w125 w150 w175 w200 w225 red-threshold red"></rect>
            <text class="target text s0 red-threshold red">17.8M</text>
        </svg>
    </g>
    <g class="results">
        <svg class="result s0 w0 p0 amount"> 
            // result = type 
            // s0 = first bar 
            // w0 = 0+ pixels 
            // p0 = 0% width (less than 10%)
            // amount = name of bar
            <rect class="result s0 w0 p0 amount"></rect>
            <text class="result text s0 amount">1.8M</text>
        </svg>
        <svg class="result s1 w0 w25 p0 p10 projected-amount projected">
            // result = type 
            // s1 = first bar
            // w0 = 0+ pixels 
            // w25 = 25+ pixels
            // p0 = 0% width 
            // p10 = 10%+ width (less than 20%)
            // projected-amount = column name
            // projected = display name
            <rect class="result s1 w0 w25 p0 p10 projected-amount projected" width="100%" height="100%"></rect>
            <text class="result text s1 projected-amount projected">5.1M</text>
        </svg>
    <g class="results-markers">
        <line class="marker s0 p0 prev-amount"></line>
    </g>
</svg>
```

## Other configurations
#### Cumulative or additive targets and results. 
By default, targets and results are cumulative. This means that the largest target or result encompasses all the smaller ones. 

Example: 
- Targets: 10M, 20M, 30M
- 30M is the total target

You can set targets and results to additive which then means all the metrics are added on top of each other:

Example: 
- Targets: 10M, 20M, 30M
- 60M is the total target

Setting results to additive is useful if you want to show multiple elements that make up the total performance. Such as the performance of two different teams added against a single goal.

#### Summaries
Summary bars can be added above the target or results bars. This is a single bar that is the full width of the total target or result. It makes it easier to interpret performance when multiple elements are combined into a single result or target. 

### Tooltips
The tooltip format can be modified by providing a custom  chart.tooltipGenerator() function. 
This function can be overwritten:
```javascript
chart.tooltipGenerator = function(chartObj,eventTarget) {return chartObj.title}
```
The function takes two parameters: 
1. chartObj = the data for the subchart
2. eventTarget = the data that the cursor is specifically pointing at within the subchart

And returns a text string that is injected into the tooltip div on hover.

### Formatting
Pacing chart provides three formatting functions:
1. Main number format (chart.formatterValue)
   - How the numbers are presented on the bars
2. Percentage format (chart.formatterPercent)
   - How percentages are presented on the bars
3. Tooltip number format (chart.formatterValueToolTip)
   - How the numbers are presented in the tool tip

ALl three of these can be overwritten before rendering the chart. They each take a single parameter, a number to format and return a formatted string.
