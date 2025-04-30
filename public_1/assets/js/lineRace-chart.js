
// function createChart(containerId, data, chartTitle) {
//   const dom = document.getElementById(containerId);

//   if (!dom) {
//     console.warn(`Chart container '${containerId}' not found`);
//     return;
//   }

//   if (dom.clientWidth === 0 || dom.clientHeight === 0) {
//     console.warn(`Waiting for valid size for '${containerId}'...`);
//     setTimeout(() => createChart(containerId, data, chartTitle), 500);
//     return;
//   }

//   const myChart = echarts.init(dom);

//   const countries = [...new Set(data.map(d => d.Country))];
//   const datasetWithFilters = [];
//   const seriesList = [];

//   echarts.util.each(countries, function (country) {
//     const datasetId = `dataset_${country}_${containerId}`;
//     datasetWithFilters.push({
//       id: datasetId,
//       fromDatasetId: 'dataset_raw',
//       transform: {
//         type: 'filter',
//         config: {
//           and: [
//             { dimension: 'Year', gte: 1950 },
//             { dimension: 'Country', '=': country }
//           ]
//         }
//       }
//     });

//     seriesList.push({
//       type: 'line',
//       datasetId,
//       showSymbol: false,
//       name: country,
//       endLabel: {
//         show: true,
//         formatter: () => country
//       },
//       labelLayout: { moveOverlap: 'shiftY' },
//       emphasis: { focus: 'series' },
//       encode: {
//         x: 'Year',
//         y: 'Income',
//         label: ['Country', 'Income'],
//         itemName: 'Year',
//         tooltip: ['Income']
//       }
//     });
//   });

//   const option = {
//     animationDuration: 2000,
//     dataset: [
//       { id: 'dataset_raw', source: data },
//       ...datasetWithFilters
//     ],
//     title: { text: chartTitle },
//     tooltip: { order: 'valueDesc', trigger: 'axis' },
//     xAxis: { type: 'category', name: 'Year' },
//     yAxis: { name: 'Income' },
//     grid: { right: 140 },
//     dataZoom: [
//       { show: true, realtime: true, start: 65, end: 85 },
//       { type: 'inside', realtime: true, start: 65, end: 85 }
//     ],
//     series: seriesList
//   };

//   myChart.setOption(option);
//   window.addEventListener('resize', () => myChart.resize());
// }

// // Chart 1
// function initChart1() {
//   const data = [
//     { Country: "Germany", Year: 1950, Income: 15000 },
//     { Country: "Germany", Year: 1960, Income: 18000 },
//     { Country: "Germany", Year: 1970, Income: 22000 },
//     { Country: "France", Year: 1950, Income: 700 },
//     { Country: "France", Year: 1960, Income: 5500 },
//     { Country: "France", Year: 1970, Income: 100 }
//   ];
//   createChart("chart_1", data, "Chart 1: Germany vs France");
// }

// // Chart 2
// function initChart2() {
//   const data = [
//     { Country: "USA", Year: 1950, Income: 25000 },
//     { Country: "USA", Year: 1960, Income: 30000 },
//     { Country: "USA", Year: 1970, Income: 35000 },
//     { Country: "UK", Year: 1950, Income: 20000 },
//     { Country: "UK", Year: 1960, Income: 24000 },
//     { Country: "UK", Year: 1970, Income: 29000 }
//   ];
//   createChart("chart_2", data, "Chart 2: USA vs UK");
// }

// // Chart 3
// function initChart3() {
//   const data = [
//     { Country: "India", Year: 1950, Income: 5000 },
//     { Country: "India", Year: 1960, Income: 8000 },
//     { Country: "India", Year: 1970, Income: 12000 },
//     { Country: "China", Year: 1950, Income: 4000 },
//     { Country: "China", Year: 1960, Income: 7000 },
//     { Country: "China", Year: 1970, Income: 11000 }
//   ];
//   createChart("chart_3", data, "Chart 3: India vs China");
// }

// // Chart 4
// function initChart4() {
//   const data = [
//     { Country: "Japan", Year: 1950, Income: 16000 },
//     { Country: "Japan", Year: 1960, Income: 21000 },
//     { Country: "Japan", Year: 1970, Income: 26000 },
//     { Country: "South Korea", Year: 1950, Income: 13000 },
//     { Country: "South Korea", Year: 1960, Income: 19000 },
//     { Country: "South Korea", Year: 1970, Income: 24000 }
//   ];
//   createChart("chart_4", data, "Chart 4: Japan vs South Korea");
// }

// // Load all charts on window load
// window.addEventListener('load', () => {
//   initChart1();
//   initChart2();
//   initChart3();
//   initChart4();
// });
