const JSZip = require('jszip');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

function numToCol(n) {
  let result = '';
  while (n > 0) {
    let remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function generateChartXml(title, catRange, valRange) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:t>${title}</a:t>
            </a:r>
          </a:p>
        </c:rich>
      </c:tx>
    </c:title>
    <c:plotArea>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:cat>
            <c:strRef>
              <c:f>${catRange}</c:f>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>${valRange}</c:f>
            </c:numRef>
          </c:val>
        </c:ser>
        <c:axId val="11111111"/>
        <c:axId val="22222222"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="11111111"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:axPos val="b"/>
        <c:crossAx val="22222222"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="22222222"/>
        <c:scaling>
          <c:orientation val="minMax"/>
          <c:max val="120"/>
        </c:scaling>
        <c:axPos val="l"/>
        <c:crossAx val="11111111"/>
        <c:title>
          <c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${title}</a:t></a:r></a:p></c:rich></c:tx>
        </c:title>
      </c:valAx>
    </c:plotArea>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

async function run() {
  console.log("Ready to implement injectNativeCharts");
}

run();
