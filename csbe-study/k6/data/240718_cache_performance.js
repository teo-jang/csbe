import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  // A number specifying the number of VUs to run concurrently.
  vus: 10,
  // A string specifying the total duration of the test run.
  duration: '10s',

  // The following section contains configuration options for execution of this
  // test script in Grafana Cloud.
  //
  // See https://grafana.com/docs/grafana-cloud/k6/get-started/run-cloud-tests-from-the-cli/
  // to learn about authoring and running k6 test scripts in Grafana k6 Cloud.
  //
  // cloud: {
  //   // The ID of the project to which the test is assigned in the k6 Cloud UI.
  //   // By default tests are executed in default project.
  //   projectID: "",
  //   // The name of the test in the k6 Cloud UI.
  //   // Test runs with the same name will be grouped.
  //   name: "240615_upload_test.js"
  // },

  // Uncomment this section to enable the use of Browser API in your tests.
  //
  // See https://grafana.com/docs/k6/latest/using-k6-browser/running-browser-tests/ to learn more
  // about using Browser API in your test scripts.
  //
  // scenarios: {
  //   // The scenario name appears in the result summary, tags, and so on.
  //   // You can give the scenario any name, as long as each name in the script is unique.
  //   ui: {
  //     // Executor is a mandatory parameter for browser-based tests.
  //     // Shared iterations in this case tells k6 to reuse VUs to execute iterations.
  //     //
  //     // See https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ for other executor types.
  //     executor: 'shared-iterations',
  //     options: {
  //       browser: {
  //         // This is a mandatory parameter that instructs k6 to launch and
  //         // connect to a chromium-based browser, and use it to run UI-based
  //         // tests.
  //         type: 'chromium',
  //       },
  //     },
  //   },
  // }
};

// The function that defines VU logic.
//
// See https://grafana.com/docs/k6/latest/examples/get-started-with-k6/ to learn more
// about authoring k6 scripts.
//
export default function() {

  const parameter_data = getRandomTrafficKey()

  let url = 'http://127.0.0.1:8000/iterator/cache_test/'
  url += parameter_data[0] + '/'
  url += parameter_data[1] + '/'
  url += parameter_data[2] + '/'
  url += parameter_data[3]
  url += '?use_cache=true'

  http.get(url);
  sleep(1);
}

const TRAFFIC_DATE_LIST = [
"2023-01-01",
"2023-01-02",
"2023-01-03",
"2023-01-04",
"2023-01-05",
"2023-01-06",
"2023-01-07",
"2023-01-08",
"2023-01-09",
"2023-01-10",
"2023-01-11",
"2023-01-12",
"2023-01-13",
"2023-01-14",
"2023-01-15",
"2023-01-16",
"2023-01-17",
"2023-01-18",
"2023-01-19",
"2023-01-20",
"2023-01-21",
"2023-01-22",
"2023-01-23",
"2023-01-24",
"2023-01-25",
"2023-01-26",
"2023-01-27",
"2023-01-28",
"2023-01-29",
"2023-01-30",
"2023-01-31",
"2023-02-01",
"2023-02-02",
"2023-02-03",
"2023-02-04",
"2023-02-05",
"2023-02-06",
"2023-02-07",
"2023-02-08",
"2023-02-09",
"2023-02-10",
"2023-02-11",
"2023-02-12",
"2023-02-13",
"2023-02-14",
"2023-02-15",
"2023-02-16",
"2023-02-17",
"2023-02-18",
"2023-02-19",
"2023-02-20",
"2023-02-21",
"2023-02-22",
"2023-02-23",
"2023-02-24",
"2023-02-25",
"2023-02-26",
"2023-02-27",
"2023-02-28",
"2023-03-01",
"2023-03-02",
"2023-03-03",
"2023-03-04",
"2023-03-05",
"2023-03-06",
"2023-03-07",
"2023-03-08",
"2023-03-09",
"2023-03-10",
"2023-03-11",
"2023-03-12",
"2023-03-13",
"2023-03-14",
"2023-03-15",
"2023-03-16",
"2023-03-17",
"2023-03-18",
"2023-03-19",
"2023-03-20",
"2023-03-21",
"2023-03-22",
"2023-03-23",
"2023-03-24",
"2023-03-25",
"2023-03-26",
"2023-03-27",
"2023-03-28",
"2023-03-29",
"2023-03-30",
"2023-03-31",
"2023-04-01",
"2023-04-02",
"2023-04-03",
"2023-04-04",
"2023-04-05",
"2023-04-06",
"2023-04-07",
"2023-04-08",
"2023-04-09",
"2023-04-10",
"2023-04-11",
"2023-04-12",
"2023-04-13",
"2023-04-14",
"2023-04-15",
"2023-04-16",
"2023-04-17",
"2023-04-18",
"2023-04-19",
"2023-04-20",
"2023-04-21",
"2023-04-22",
"2023-04-23",
"2023-04-24",
"2023-04-25",
"2023-04-26",
"2023-04-27",
"2023-04-28",
"2023-04-29",
"2023-04-30",
"2023-05-01",
"2023-05-02",
"2023-05-03",
"2023-05-04",
"2023-05-05",
"2023-05-06",
"2023-05-07",
"2023-05-08",
"2023-05-09",
"2023-05-10",
"2023-05-11",
"2023-05-12",
"2023-05-13",
"2023-05-14",
"2023-05-15",
"2023-05-16",
"2023-05-17",
"2023-05-18",
"2023-05-19",
"2023-05-20",
"2023-05-21",
"2023-05-22",
"2023-05-23",
"2023-05-24",
"2023-05-25",
"2023-05-26",
"2023-05-27",
"2023-05-28",
"2023-05-29",
"2023-05-30",
"2023-05-31",
"2023-06-01",
"2023-06-02",
"2023-06-03",
"2023-06-04",
"2023-06-05",
"2023-06-06",
"2023-06-07",
"2023-06-08",
"2023-06-09",
"2023-06-10",
"2023-06-11",
"2023-06-12",
"2023-06-13",
"2023-06-14",
"2023-06-15",
"2023-06-16",
"2023-06-17",
"2023-06-18",
"2023-06-19",
"2023-06-20",
"2023-06-21",
"2023-06-22",
"2023-06-23",
"2023-06-24",
"2023-06-25",
"2023-06-26",
"2023-06-27",
"2023-06-28",
"2023-06-29",
"2023-06-30",
"2023-07-01",
"2023-07-02",
"2023-07-03",
"2023-07-04",
"2023-07-05",
"2023-07-06",
"2023-07-07",
"2023-07-08",
"2023-07-09",
"2023-07-10",
"2023-07-11",
"2023-07-12",
"2023-07-13",
"2023-07-14",
"2023-07-15",
"2023-07-16",
"2023-07-17",
"2023-07-18",
"2023-07-19",
"2023-07-20",
"2023-07-21",
"2023-07-22",
"2023-07-23",
"2023-07-24",
"2023-07-25",
"2023-07-26",
"2023-07-27",
"2023-07-28",
"2023-07-29",
"2023-07-30",
"2023-07-31",
"2023-08-01",
"2023-08-02",
"2023-08-03",
"2023-08-04",
"2023-08-05",
"2023-08-06",
"2023-08-07",
"2023-08-08",
"2023-08-09",
"2023-08-10",
"2023-08-11",
"2023-08-12",
"2023-08-13",
"2023-08-14",
"2023-08-15",
"2023-08-16",
"2023-08-17",
"2023-08-18",
"2023-08-19",
"2023-08-20",
"2023-08-21",
"2023-08-22",
"2023-08-23",
"2023-08-24",
"2023-08-25",
"2023-08-26",
"2023-08-27",
"2023-08-28",
"2023-08-29",
"2023-08-30",
"2023-08-31",
"2023-09-01",
"2023-09-02",
"2023-09-03",
"2023-09-04",
"2023-09-05",
"2023-09-06",
"2023-09-07",
"2023-09-08",
"2023-09-09",
"2023-09-10",
"2023-09-11",
"2023-09-12",
"2023-09-13",
"2023-09-14",
"2023-09-15",
"2023-09-16",
"2023-09-17",
"2023-09-18",
"2023-09-19",
"2023-09-20",
"2023-09-21",
"2023-09-22",
"2023-09-23",
"2023-09-24",
"2023-09-25",
"2023-09-26",
"2023-09-27",
"2023-09-28",
"2023-09-29",
"2023-09-30",
]

const TRAFFIC_KEY_LIST = [
  ["1호선","동대문","승차"],
  ["1호선","동대문","하차"],
  ["1호선","동묘앞","승차"],
  ["1호선","동묘앞","하차"],
  ["1호선","서울역","승차"],
  ["1호선","서울역","하차"],
  ["1호선","시청","승차"],
  ["1호선","시청","하차"],
  ["1호선","신설동","승차"],
  ["1호선","신설동","하차"],
  ["1호선","제기동","승차"],
  ["1호선","제기동","하차"],
  ["1호선","종각","승차"],
  ["1호선","종각","하차"],
  ["1호선","종로3가","승차"],
  ["1호선","종로3가","하차"],
  ["1호선","종로5가","승차"],
  ["1호선","종로5가","하차"],
  ["1호선","청량리(서울시립대입구)","승차"],
  ["1호선","청량리(서울시립대입구)","하차"],
  ["2호선","강남","승차"],
  ["2호선","강남","하차"],
  ["2호선","강변(동서울터미널)","승차"],
  ["2호선","강변(동서울터미널)","하차"],
  ["2호선","건대입구","승차"],
  ["2호선","건대입구","하차"],
  ["2호선","교대(법원.검찰청)","승차"],
  ["2호선","교대(법원.검찰청)","하차"],
  ["2호선","구로디지털단지","승차"],
  ["2호선","구로디지털단지","하차"],
  ["2호선","구의(광진구청)","승차"],
  ["2호선","구의(광진구청)","하차"],
  ["2호선","낙성대(강감찬)","승차"],
  ["2호선","낙성대(강감찬)","하차"],
  ["2호선","당산","승차"],
  ["2호선","당산","하차"],
  ["2호선","대림(구로구청)","승차"],
  ["2호선","대림(구로구청)","하차"],
  ["2호선","도림천","승차"],
  ["2호선","도림천","하차"],
  ["2호선","동대문역사문화공원(DDP)","승차"],
  ["2호선","동대문역사문화공원(DDP)","하차"],
  ["2호선","뚝섬","승차"],
  ["2호선","뚝섬","하차"],
  ["2호선","문래","승차"],
  ["2호선","문래","하차"],
  ["2호선","방배","승차"],
  ["2호선","방배","하차"],
  ["2호선","봉천","승차"],
  ["2호선","봉천","하차"],
  ["2호선","사당","승차"],
  ["2호선","사당","하차"],
  ["2호선","삼성(무역센터)","승차"],
  ["2호선","삼성(무역센터)","하차"],
  ["2호선","상왕십리","승차"],
  ["2호선","상왕십리","하차"],
  ["2호선","서울대입구(관악구청)","승차"],
  ["2호선","서울대입구(관악구청)","하차"],
  ["2호선","서초","승차"],
  ["2호선","서초","하차"],
  ["2호선","선릉","승차"],
  ["2호선","선릉","하차"],
  ["2호선","성수","승차"],
  ["2호선","성수","하차"],
  ["2호선","시청","승차"],
  ["2호선","시청","하차"],
  ["2호선","신답","승차"],
  ["2호선","신답","하차"],
  ["2호선","신당","승차"],
  ["2호선","신당","하차"],
  ["2호선","신대방","승차"],
  ["2호선","신대방","하차"],
  ["2호선","신도림","승차"],
  ["2호선","신도림","하차"],
  ["2호선","신림","승차"],
  ["2호선","신림","하차"],
  ["2호선","신설동","승차"],
  ["2호선","신설동","하차"],
  ["2호선","신정네거리","승차"],
  ["2호선","신정네거리","하차"],
  ["2호선","신촌","승차"],
  ["2호선","신촌","하차"],
  ["2호선","아현","승차"],
  ["2호선","아현","하차"],
  ["2호선","양천구청","승차"],
  ["2호선","양천구청","하차"],
  ["2호선","역삼","승차"],
  ["2호선","역삼","하차"],
  ["2호선","영등포구청","승차"],
  ["2호선","영등포구청","하차"],
  ["2호선","왕십리(성동구청)","승차"],
  ["2호선","왕십리(성동구청)","하차"],
  ["2호선","용답","승차"],
  ["2호선","용답","하차"],
  ["2호선","용두(동대문구청)","승차"],
  ["2호선","용두(동대문구청)","하차"],
  ["2호선","을지로3가","승차"],
  ["2호선","을지로3가","하차"],
  ["2호선","을지로4가","승차"],
  ["2호선","을지로4가","하차"],
  ["2호선","을지로입구","승차"],
  ["2호선","을지로입구","하차"],
  ["2호선","이대","승차"],
  ["2호선","이대","하차"],
  ["2호선","잠실(송파구청)","승차"],
  ["2호선","잠실(송파구청)","하차"],
  ["2호선","잠실나루","승차"],
  ["2호선","잠실나루","하차"],
  ["2호선","잠실새내","승차"],
  ["2호선","잠실새내","하차"],
  ["2호선","종합운동장","승차"],
  ["2호선","종합운동장","하차"],
  ["2호선","충정로(경기대입구)","승차"],
  ["2호선","충정로(경기대입구)","하차"],
  ["2호선","한양대","승차"],
  ["2호선","한양대","하차"],
  ["2호선","합정","승차"],
  ["2호선","합정","하차"],
  ["2호선","홍대입구","승차"],
  ["2호선","홍대입구","하차"],
  ["3호선","가락시장","승차"],
  ["3호선","가락시장","하차"],
  ["3호선","경복궁(정부서울청사)","승차"],
  ["3호선","경복궁(정부서울청사)","하차"],
  ["3호선","경찰병원","승차"],
  ["3호선","경찰병원","하차"],
  ["3호선","고속터미널","승차"],
  ["3호선","고속터미널","하차"],
  ["3호선","교대(법원.검찰청)","승차"],
  ["3호선","교대(법원.검찰청)","하차"],
  ["3호선","구파발","승차"],
  ["3호선","구파발","하차"],
  ["3호선","금호","승차"],
  ["3호선","금호","하차"],
  ["3호선","남부터미널(예술의전당)","승차"],
  ["3호선","남부터미널(예술의전당)","하차"],
  ["3호선","녹번","승차"],
  ["3호선","녹번","하차"],
  ["3호선","대청","승차"],
  ["3호선","대청","하차"],
  ["3호선","대치","승차"],
  ["3호선","대치","하차"],
  ["3호선","도곡","승차"],
  ["3호선","도곡","하차"],
  ["3호선","독립문","승차"],
  ["3호선","독립문","하차"],
  ["3호선","동대입구","승차"],
  ["3호선","동대입구","하차"],
  ["3호선","매봉","승차"],
  ["3호선","매봉","하차"],
  ["3호선","무악재","승차"],
  ["3호선","무악재","하차"],
  ["3호선","불광","승차"],
  ["3호선","불광","하차"],
  ["3호선","수서","승차"],
  ["3호선","수서","하차"],
  ["3호선","신사","승차"],
  ["3호선","신사","하차"],
  ["3호선","안국","승차"],
  ["3호선","안국","하차"],
  ["3호선","압구정","승차"],
  ["3호선","압구정","하차"],
  ["3호선","약수","승차"],
  ["3호선","약수","하차"],
  ["3호선","양재(서초구청)","승차"],
  ["3호선","양재(서초구청)","하차"],
  ["3호선","연신내","승차"],
  ["3호선","연신내","하차"],
  ["3호선","오금","승차"],
  ["3호선","오금","하차"],
  ["3호선","옥수","승차"],
  ["3호선","옥수","하차"],
  ["3호선","을지로3가","승차"],
  ["3호선","을지로3가","하차"],
  ["3호선","일원","승차"],
  ["3호선","일원","하차"],
  ["3호선","잠원","승차"],
  ["3호선","잠원","하차"],
  ["3호선","종로3가","승차"],
  ["3호선","종로3가","하차"],
  ["3호선","지축","승차"],
  ["3호선","지축","하차"],
  ["3호선","학여울","승차"],
  ["3호선","학여울","하차"],
  ["3호선","홍제","승차"],
  ["3호선","홍제","하차"],
  ["4호선","길음","승차"],
  ["4호선","길음","하차"],
  ["4호선","남태령","승차"],
  ["4호선","남태령","하차"],
  ["4호선","노원","승차"],
  ["4호선","노원","하차"],
  ["4호선","당고개","승차"],
  ["4호선","당고개","하차"],
  ["4호선","동대문","승차"],
  ["4호선","동대문","하차"],
  ["4호선","동대문역사문화공원(DDP)","승차"],
  ["4호선","동대문역사문화공원(DDP)","하차"],
  ["4호선","동작(현충원)","승차"],
  ["4호선","동작(현충원)","하차"],
  ["4호선","명동","승차"],
  ["4호선","명동","하차"],
  ["4호선","미아(서울사이버대학)","승차"],
  ["4호선","미아(서울사이버대학)","하차"],
  ["4호선","미아사거리","승차"],
  ["4호선","미아사거리","하차"],
  ["4호선","사당","승차"],
  ["4호선","사당","하차"],
  ["4호선","삼각지","승차"],
  ["4호선","삼각지","하차"],
  ["4호선","상계","승차"],
  ["4호선","상계","하차"],
  ["4호선","서울역","승차"],
  ["4호선","서울역","하차"],
  ["4호선","성신여대입구(돈암)","승차"],
  ["4호선","성신여대입구(돈암)","하차"],
  ["4호선","수유(강북구청)","승차"],
  ["4호선","수유(강북구청)","하차"],
  ["4호선","숙대입구(갈월)","승차"],
  ["4호선","숙대입구(갈월)","하차"],
  ["4호선","신용산","승차"],
  ["4호선","신용산","하차"],
  ["4호선","쌍문","승차"],
  ["4호선","쌍문","하차"],
  ["4호선","이촌(국립중앙박물관)","승차"],
  ["4호선","이촌(국립중앙박물관)","하차"],
  ["4호선","창동","승차"],
  ["4호선","창동","하차"],
  ["4호선","총신대입구(이수)","승차"],
  ["4호선","총신대입구(이수)","하차"],
  ["4호선","충무로","승차"],
  ["4호선","충무로","하차"],
  ["4호선","한성대입구(삼선교)","승차"],
  ["4호선","한성대입구(삼선교)","하차"],
  ["4호선","혜화","승차"],
  ["4호선","혜화","하차"],
  ["4호선","회현(남대문시장)","승차"],
  ["4호선","회현(남대문시장)","하차"],
  ["5호선","강동","승차"],
  ["5호선","강동","하차"],
  ["5호선","강일","승차"],
  ["5호선","강일","하차"],
  ["5호선","개롱","승차"],
  ["5호선","개롱","하차"],
  ["5호선","개화산","승차"],
  ["5호선","개화산","하차"],
  ["5호선","거여","승차"],
  ["5호선","거여","하차"],
  ["5호선","고덕","승차"],
  ["5호선","고덕","하차"],
  ["5호선","공덕","승차"],
  ["5호선","공덕","하차"],
  ["5호선","광나루(장신대)","승차"],
  ["5호선","광나루(장신대)","하차"],
  ["5호선","광화문(세종문화회관)","승차"],
  ["5호선","광화문(세종문화회관)","하차"],
  ["5호선","군자(능동)","승차"],
  ["5호선","군자(능동)","하차"],
  ["5호선","굽은다리(강동구민회관앞)","승차"],
  ["5호선","굽은다리(강동구민회관앞)","하차"],
  ["5호선","길동","승차"],
  ["5호선","길동","하차"],
  ["5호선","김포공항","승차"],
  ["5호선","김포공항","하차"],
  ["5호선","까치산","승차"],
  ["5호선","까치산","하차"],
  ["5호선","답십리","승차"],
  ["5호선","답십리","하차"],
  ["5호선","동대문역사문화공원(DDP)","승차"],
  ["5호선","동대문역사문화공원(DDP)","하차"],
  ["5호선","둔촌동","승차"],
  ["5호선","둔촌동","하차"],
  ["5호선","마곡","승차"],
  ["5호선","마곡","하차"],
  ["5호선","마장","승차"],
  ["5호선","마장","하차"],
  ["5호선","마천","승차"],
  ["5호선","마천","하차"],
  ["5호선","마포","승차"],
  ["5호선","마포","하차"],
  ["5호선","명일","승차"],
  ["5호선","명일","하차"],
  ["5호선","목동","승차"],
  ["5호선","목동","하차"],
  ["5호선","미사","승차"],
  ["5호선","미사","하차"],
  ["5호선","발산","승차"],
  ["5호선","발산","하차"],
  ["5호선","방이","승차"],
  ["5호선","방이","하차"],
  ["5호선","방화","승차"],
  ["5호선","방화","하차"],
  ["5호선","상일동","승차"],
  ["5호선","상일동","하차"],
  ["5호선","서대문","승차"],
  ["5호선","서대문","하차"],
  ["5호선","송정","승차"],
  ["5호선","송정","하차"],
  ["5호선","신금호","승차"],
  ["5호선","신금호","하차"],
  ["5호선","신길","승차"],
  ["5호선","신길","하차"],
  ["5호선","신정(은행정)","승차"],
  ["5호선","신정(은행정)","하차"],
  ["5호선","아차산(어린이대공원후문)","승차"],
  ["5호선","아차산(어린이대공원후문)","하차"],
  ["5호선","애오개","승차"],
  ["5호선","애오개","하차"],
  ["5호선","양평","승차"],
  ["5호선","양평","하차"],
  ["5호선","여의나루","승차"],
  ["5호선","여의나루","하차"],
  ["5호선","여의도","승차"],
  ["5호선","여의도","하차"],
  ["5호선","영등포구청","승차"],
  ["5호선","영등포구청","하차"],
  ["5호선","영등포시장","승차"],
  ["5호선","영등포시장","하차"],
  ["5호선","오금","승차"],
  ["5호선","오금","하차"],
  ["5호선","오목교(목동운동장앞)","승차"],
  ["5호선","오목교(목동운동장앞)","하차"],
  ["5호선","올림픽공원(한국체대)","승차"],
  ["5호선","올림픽공원(한국체대)","하차"],
  ["5호선","왕십리(성동구청)","승차"],
  ["5호선","왕십리(성동구청)","하차"],
  ["5호선","우장산","승차"],
  ["5호선","우장산","하차"],
  ["5호선","을지로4가","승차"],
  ["5호선","을지로4가","하차"],
  ["5호선","장한평","승차"],
  ["5호선","장한평","하차"],
  ["5호선","종로3가","승차"],
  ["5호선","종로3가","하차"],
  ["5호선","천호(풍납토성)","승차"],
  ["5호선","천호(풍납토성)","하차"],
  ["5호선","청구","승차"],
  ["5호선","청구","하차"],
  ["5호선","충정로(경기대입구)","승차"],
  ["5호선","충정로(경기대입구)","하차"],
  ["5호선","하남검단산","승차"],
  ["5호선","하남검단산","하차"],
  ["5호선","하남시청(덕풍·신장)","승차"],
  ["5호선","하남시청(덕풍·신장)","하차"],
  ["5호선","하남풍산","승차"],
  ["5호선","하남풍산","하차"],
  ["5호선","행당","승차"],
  ["5호선","행당","하차"],
  ["5호선","화곡","승차"],
  ["5호선","화곡","하차"],
  ["6호선","고려대(종암)","승차"],
  ["6호선","고려대(종암)","하차"],
  ["6호선","공덕","승차"],
  ["6호선","공덕","하차"],
  ["6호선","광흥창(서강)","승차"],
  ["6호선","광흥창(서강)","하차"],
  ["6호선","구산","승차"],
  ["6호선","구산","하차"],
  ["6호선","녹사평(용산구청)","승차"],
  ["6호선","녹사평(용산구청)","하차"],
  ["6호선","대흥(서강대앞)","승차"],
  ["6호선","대흥(서강대앞)","하차"],
  ["6호선","독바위","승차"],
  ["6호선","독바위","하차"],
  ["6호선","돌곶이","승차"],
  ["6호선","돌곶이","하차"],
  ["6호선","동묘앞","승차"],
  ["6호선","동묘앞","하차"],
  ["6호선","디지털미디어시티","승차"],
  ["6호선","디지털미디어시티","하차"],
  ["6호선","마포구청","승차"],
  ["6호선","마포구청","하차"],
  ["6호선","망원","승차"],
  ["6호선","망원","하차"],
  ["6호선","버티고개","승차"],
  ["6호선","버티고개","하차"],
  ["6호선","보문","승차"],
  ["6호선","보문","하차"],
  ["6호선","봉화산(서울의료원)","승차"],
  ["6호선","봉화산(서울의료원)","하차"],
  ["6호선","불광","승차"],
  ["6호선","불광","하차"],
  ["6호선","삼각지","승차"],
  ["6호선","삼각지","하차"],
  ["6호선","상수","승차"],
  ["6호선","상수","하차"],
  ["6호선","상월곡(한국과학기술연구원)","승차"],
  ["6호선","상월곡(한국과학기술연구원)","하차"],
  ["6호선","새절(신사)","승차"],
  ["6호선","새절(신사)","하차"],
  ["6호선","석계","승차"],
  ["6호선","석계","하차"],
  ["6호선","신당","승차"],
  ["6호선","신당","하차"],
  ["6호선","안암(고대병원앞)","승차"],
  ["6호선","안암(고대병원앞)","하차"],
  ["6호선","약수","승차"],
  ["6호선","약수","하차"],
  ["6호선","역촌","승차"],
  ["6호선","역촌","하차"],
  ["6호선","월곡(동덕여대)","승차"],
  ["6호선","월곡(동덕여대)","하차"],
  ["6호선","월드컵경기장(성산)","승차"],
  ["6호선","월드컵경기장(성산)","하차"],
  ["6호선","응암","승차"],
  ["6호선","응암","하차"],
  ["6호선","이태원","승차"],
  ["6호선","이태원","하차"],
  ["6호선","증산(명지대앞)","승차"],
  ["6호선","증산(명지대앞)","하차"],
  ["6호선","창신","승차"],
  ["6호선","창신","하차"],
  ["6호선","청구","승차"],
  ["6호선","청구","하차"],
  ["6호선","태릉입구","승차"],
  ["6호선","태릉입구","하차"],
  ["6호선","한강진","승차"],
  ["6호선","한강진","하차"],
  ["6호선","합정","승차"],
  ["6호선","합정","하차"],
  ["6호선","화랑대(서울여대입구)","승차"],
  ["6호선","화랑대(서울여대입구)","하차"],
  ["6호선","효창공원앞","승차"],
  ["6호선","효창공원앞","하차"],
  ["7호선","가산디지털단지","승차"],
  ["7호선","가산디지털단지","하차"],
  ["7호선","강남구청","승차"],
  ["7호선","강남구청","하차"],
  ["7호선","건대입구","승차"],
  ["7호선","건대입구","하차"],
  ["7호선","고속터미널","승차"],
  ["7호선","고속터미널","하차"],
  ["7호선","공릉(서울과학기술대)","승차"],
  ["7호선","공릉(서울과학기술대)","하차"],
  ["7호선","광명사거리","승차"],
  ["7호선","광명사거리","하차"],
  ["7호선","군자(능동)","승차"],
  ["7호선","군자(능동)","하차"],
  ["7호선","남구로","승차"],
  ["7호선","남구로","하차"],
  ["7호선","남성","승차"],
  ["7호선","남성","하차"],
  ["7호선","내방","승차"],
  ["7호선","내방","하차"],
  ["7호선","노원","승차"],
  ["7호선","노원","하차"],
  ["7호선","논현","승차"],
  ["7호선","논현","하차"],
  ["7호선","대림(구로구청)","승차"],
  ["7호선","대림(구로구청)","하차"],
  ["7호선","도봉산","승차"],
  ["7호선","도봉산","하차"],
  ["7호선","뚝섬유원지","승차"],
  ["7호선","뚝섬유원지","하차"],
  ["7호선","마들","승차"],
  ["7호선","마들","하차"],
  ["7호선","먹골","승차"],
  ["7호선","먹골","하차"],
  ["7호선","면목","승차"],
  ["7호선","면목","하차"],
  ["7호선","반포","승차"],
  ["7호선","반포","하차"],
  ["7호선","보라매","승차"],
  ["7호선","보라매","하차"],
  ["7호선","사가정","승차"],
  ["7호선","사가정","하차"],
  ["7호선","상도","승차"],
  ["7호선","상도","하차"],
  ["7호선","상봉(시외버스터미널)","승차"],
  ["7호선","상봉(시외버스터미널)","하차"],
  ["7호선","수락산","승차"],
  ["7호선","수락산","하차"],
  ["7호선","숭실대입구(살피재)","승차"],
  ["7호선","숭실대입구(살피재)","하차"],
  ["7호선","신대방삼거리","승차"],
  ["7호선","신대방삼거리","하차"],
  ["7호선","신풍","승차"],
  ["7호선","신풍","하차"],
  ["7호선","어린이대공원(세종대)","승차"],
  ["7호선","어린이대공원(세종대)","하차"],
  ["7호선","온수(성공회대입구)","승차"],
  ["7호선","온수(성공회대입구)","하차"],
  ["7호선","용마산(용마폭포공원)","승차"],
  ["7호선","용마산(용마폭포공원)","하차"],
  ["7호선","이수","승차"],
  ["7호선","이수","하차"],
  ["7호선","장승배기","승차"],
  ["7호선","장승배기","하차"],
  ["7호선","장암","승차"],
  ["7호선","장암","하차"],
  ["7호선","중계","승차"],
  ["7호선","중계","하차"],
  ["7호선","중곡","승차"],
  ["7호선","중곡","하차"],
  ["7호선","중화","승차"],
  ["7호선","중화","하차"],
  ["7호선","천왕","승차"],
  ["7호선","천왕","하차"],
  ["7호선","철산","승차"],
  ["7호선","철산","하차"],
]

function getRandomTrafficKey() {
  const random_date = [TRAFFIC_DATE_LIST[Math.floor(Math.random()*TRAFFIC_DATE_LIST.length)]]
  const random_key = TRAFFIC_KEY_LIST[Math.floor(Math.random()*TRAFFIC_KEY_LIST.length)]

  return random_date.concat(random_key)
}
