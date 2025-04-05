// var dom = document.getElementById('lineRaceChart');
// var myChart = echarts.init(dom, null, {
//   renderer: 'canvas',
//   useDirtyRect: false
// });
// var app = {};
// var ROOT_PATH = 'https://echarts.apache.org/examples';
// var option;

// $.get(
// ROOT_PATH + '/data/asset/data/life-expectancy-table.json',
// function (_rawData) {
// run(_rawData);
// }
// );
// function run(_rawData) {
// // var countries = ['Australia', 'Canada', 'China', 'Cuba', 'Finland', 'France', 'Germany', 'Iceland', 'India', 'Japan', 'North Korea', 'South Korea', 'New Zealand', 'Norway', 'Poland', 'Russia', 'Turkey', 'United Kingdom', 'United States'];
// const countries = [
// 'Finland',
// 'France',
// 'Germany',
// 'Iceland',
// 'Norway',
// 'Poland',
// 'Russia',
// 'United Kingdom'
// ];
// const datasetWithFilters = [];
// const seriesList = [];
// echarts.util.each(countries, function (country) {
// var datasetId = 'dataset_' + country;
// datasetWithFilters.push({
//   id: datasetId,
//   fromDatasetId: 'dataset_raw',
//   transform: {
//     type: 'filter',
//     config: {
//       and: [
//         { dimension: 'Year', gte: 1950 },
//         { dimension: 'Country', '=': country }
//       ]
//     }
//   }
// });
// seriesList.push({
//   type: 'line',
//   datasetId: datasetId,
//   showSymbol: false,
//   name: country,
//   endLabel: {
//     show: true,
//     formatter: function (params) {
//       return params.value[3] + ': ' + params.value[0];
//     }
//   },
//   labelLayout: {
//     moveOverlap: 'shiftY'
//   },
//   emphasis: {
//     focus: 'series'
//   },
//   encode: {
//     x: 'Year',
//     y: 'Income',
//     label: ['Country', 'Income'],
//     itemName: 'Year',
//     tooltip: ['Income']
//   }
// });
// });
// option = {
// animationDuration: 10000,
// dataset: [
//   {
//     id: 'dataset_raw',
//     source: _rawData
//   },
//   ...datasetWithFilters
// ],
// title: {
//   text: 'Income of Germany and France since 1950'
// },
// tooltip: {
//   order: 'valueDesc',
//   trigger: 'axis'
// },
// xAxis: {
//   type: 'category',
//   nameLocation: 'middle'
// },
// yAxis: {
//   name: 'Income'
// },
// grid: {
//   right: 140
// },
// series: seriesList
// };
// myChart.setOption(option);
// }

// if (option && typeof option === 'object') {
//   myChart.setOption(option);
// }

// window.addEventListener('resize', myChart.resize);

// var dom = document.getElementById('lineRaceChart');
//     var myChart = echarts.init(dom, null, {
//       renderer: 'canvas',
//       useDirtyRect: false
//     });

//     // ✅ JSON data manually embedded (instead of AJAX request)
//     var jsonData = [
//       { "Country": "Germany", "Year": 1950, "Income": 15000 },
//       { "Country": "Germany", "Year": 1960, "Income": 18000 },
//       { "Country": "Germany", "Year": 1970, "Income": 22000 },
//       { "Country": "France", "Year": 1950, "Income": 14000 },
//       { "Country": "France", "Year": 1960, "Income": 17500 },
//       { "Country": "France", "Year": 1970, "Income": 21000 }
//     ];

//     function run(_rawData) {
//       const countries = ["Germany", "France"];
//       const datasetWithFilters = [];
//       const seriesList = [];

//       echarts.util.each(countries, function (country) {
//         var datasetId = 'dataset_' + country;
//         datasetWithFilters.push({
//           id: datasetId,
//           fromDatasetId: 'dataset_raw',
//           transform: {
//             type: 'filter',
//             config: {
//               and: [
//                 { dimension: 'Year', gte: 1950 },
//                 { dimension: 'Country', '=': country }
//               ]
//             }
//           }
//         });

//         seriesList.push({
//           type: 'line',
//           datasetId: datasetId,
//           showSymbol: false,
//           name: country,
//           endLabel: {
//             show: true,
//             formatter: function (params) {
//               return country; // ✅ FIXED: params.value[2] is 'Income'
//             }
//           },
//           labelLayout: { moveOverlap: 'shiftY' },
//           emphasis: { focus: 'series' },
//           encode: {
//             x: 'Year',
//             y: 'Income',
//             label: ['Country', 'Income'],
//             itemName: 'Year',
//             tooltip: ['Income']
//           }
//         });
//       });

//       var option = {
//         animationDuration: 5000,
//         dataset: [
//           { id: 'dataset_raw', source: _rawData },
//           ...datasetWithFilters
//         ],
//         title: { text: 'Income of Germany and France since 1950' },
//         tooltip: { order: 'valueDesc', trigger: 'axis' },
//         xAxis: { type: 'category', name: 'Year' },
//         yAxis: { name: 'Income' },
//         grid: { right: 140 },
//         series: seriesList
//       };

//       myChart.setOption(option);
//     }

//     // ✅ Directly pass local JSON data to the function
//     run(jsonData);

//     window.addEventListener('resize', myChart.resize);

var jsonData = [
  { "Country": "Germany", "Year": 1950, "Income": 15000 },
  { "Country": "Germany", "Year": 1960, "Income": 18000 },
  { "Country": "Germany", "Year": 1970, "Income": 22000 },
  { "Country": "France", "Year": 1950, "Income": 14000 },
  { "Country": "France", "Year": 1960, "Income": 17500 },
  { "Country": "France", "Year": 1970, "Income": 21000 }
];

function initChart() {
  var dom = document.getElementById('lineRaceChart');

  // Ensure width and height are valid
  if (dom.clientWidth === 0 || dom.clientHeight === 0) {
    console.warn("Waiting for valid container size...");
    setTimeout(initChart, 500); // Retry after 500ms
    return;
  }

  var myChart = echarts.init(dom);

  function run(_rawData) {
    const countries = ["Germany", "France"];
    const datasetWithFilters = [];
    const seriesList = [];

    echarts.util.each(countries, function (country) {
      var datasetId = 'dataset_' + country;
      datasetWithFilters.push({
        id: datasetId,
        fromDatasetId: 'dataset_raw',
        transform: {
          type: 'filter',
          config: {
            and: [
              { dimension: 'Year', gte: 1950 },
              { dimension: 'Country', '=': country }
            ]
          }
        }
      });

      seriesList.push({
        type: 'line',
        datasetId: datasetId,
        showSymbol: false,
        name: country,
        endLabel: {
          show: true,
          formatter: function () {
            return country;
          }
        },
        labelLayout: { moveOverlap: 'shiftY' },
        emphasis: { focus: 'series' },
        encode: {
          x: 'Year',
          y: 'Income',
          label: ['Country', 'Income'],
          itemName: 'Year',
          tooltip: ['Income']
        }
      });
    });

    var option = {
      animationDuration: 5000,
      dataset: [{ id: 'dataset_raw', source: _rawData }, ...datasetWithFilters],
      dataZoom: [
        {
          show: true,
          realtime: true,
          start: 65,
          end: 85
        },
        {
          type: 'inside',
          realtime: true,
          start: 65,
          end: 85
        }
      ],
      title: { text: 'Income of Germany and France since 1950' },
      tooltip: { order: 'valueDesc', trigger: 'axis' },
      xAxis: { type: 'category', name: 'Year' },
      yAxis: { name: 'Income' },
      grid: { right: 140 },
      series: seriesList
    };

    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
  }

  run(jsonData);
}

// Ensure chart is initialized properly
window.addEventListener('load', initChart);