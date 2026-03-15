const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const FONT_PATH = 'C:/Windows/Fonts/malgun.ttf';
const FONT_BOLD = 'C:/Windows/Fonts/malgunbd.ttf';

// Colors
const C = {
  primary: '#1E40AF',
  secondary: '#6B7280',
  accent: '#10B981',
  dark: '#111827',
  light: '#F3F4F6',
  white: '#FFFFFF',
  warning: '#F59E0B',
  danger: '#EF4444',
  blue50: '#EFF6FF',
  green50: '#ECFDF5',
  yellow50: '#FFFBEB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray600: '#4B5563',
  gray800: '#1F2937',
};

function createDoc(filename) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 50, right: 50 } });
  const stream = fs.createWriteStream(filename);
  doc.pipe(stream);
  return { doc, stream };
}

// Helper functions
function pageHeader(doc, text) {
  doc.addPage();
  doc.font(FONT_BOLD).fontSize(22).fillColor(C.primary).text(text, 50, 60);
  doc.moveTo(50, 90).lineTo(545, 90).strokeColor(C.primary).lineWidth(2).stroke();
  doc.y = 105;
  return doc;
}

function sectionTitle(doc, text) {
  const y = doc.y + 8;
  if (y > 700) { doc.addPage(); doc.y = 60; }
  doc.font(FONT_BOLD).fontSize(14).fillColor(C.gray800).text(text, 50, doc.y + 8);
  doc.y = doc.y + 6;
  return doc;
}

function subTitle(doc, text) {
  if (doc.y > 710) { doc.addPage(); doc.y = 60; }
  doc.font(FONT_BOLD).fontSize(11).fillColor(C.primary).text(text, 55, doc.y + 4);
  doc.y = doc.y + 2;
  return doc;
}

function para(doc, text, indent = 50) {
  if (doc.y > 710) { doc.addPage(); doc.y = 60; }
  doc.font(FONT_PATH).fontSize(10).fillColor(C.dark).text(text, indent, doc.y + 2, { width: 545 - indent, lineGap: 3 });
  doc.y = doc.y + 4;
  return doc;
}

function bullet(doc, text, indent = 65) {
  if (doc.y > 720) { doc.addPage(); doc.y = 60; }
  const bulletY = doc.y + 2;
  doc.font(FONT_PATH).fontSize(10).fillColor(C.dark);
  doc.text('\u2022', indent - 12, bulletY);
  doc.text(text, indent, bulletY, { width: 545 - indent, lineGap: 3 });
  doc.y = doc.y + 2;
  return doc;
}

function numberedItem(doc, num, text, indent = 65) {
  if (doc.y > 720) { doc.addPage(); doc.y = 60; }
  const itemY = doc.y + 2;
  doc.font(FONT_BOLD).fontSize(10).fillColor(C.primary).text(`${num}.`, indent - 18, itemY);
  doc.font(FONT_PATH).fontSize(10).fillColor(C.dark).text(text, indent, itemY, { width: 545 - indent, lineGap: 3 });
  doc.y = doc.y + 2;
  return doc;
}

function infoBox(doc, title, text) {
  if (doc.y > 670) { doc.addPage(); doc.y = 60; }
  const boxY = doc.y + 6;
  const textWidth = 475;
  // Measure text height
  const h = doc.font(FONT_PATH).fontSize(9.5).heightOfString(text, { width: textWidth, lineGap: 2 });
  const boxH = h + 38;

  doc.roundedRect(55, boxY, 490, boxH, 4).fillColor(C.blue50).fill();
  doc.roundedRect(55, boxY, 3, boxH, 1).fillColor(C.primary).fill();
  doc.font(FONT_BOLD).fontSize(10).fillColor(C.primary).text(title, 70, boxY + 8);
  doc.font(FONT_PATH).fontSize(9.5).fillColor(C.gray800).text(text, 70, boxY + 24, { width: textWidth, lineGap: 2 });
  doc.y = boxY + boxH + 4;
  return doc;
}

function tipBox(doc, text) {
  if (doc.y > 670) { doc.addPage(); doc.y = 60; }
  const boxY = doc.y + 6;
  const textWidth = 465;
  const h = doc.font(FONT_PATH).fontSize(9.5).heightOfString(text, { width: textWidth, lineGap: 2 });
  const boxH = h + 20;
  doc.roundedRect(55, boxY, 490, boxH, 4).fillColor(C.green50).fill();
  doc.roundedRect(55, boxY, 3, boxH, 1).fillColor(C.accent).fill();
  doc.font(FONT_BOLD).fontSize(9.5).fillColor(C.accent).text('TIP', 70, boxY + 6);
  doc.font(FONT_PATH).fontSize(9.5).fillColor(C.gray800).text(text, 100, boxY + 6, { width: textWidth, lineGap: 2 });
  doc.y = boxY + boxH + 4;
  return doc;
}

function warnBox(doc, text) {
  if (doc.y > 670) { doc.addPage(); doc.y = 60; }
  const boxY = doc.y + 6;
  const textWidth = 460;
  const h = doc.font(FONT_PATH).fontSize(9.5).heightOfString(text, { width: textWidth, lineGap: 2 });
  const boxH = h + 20;
  doc.roundedRect(55, boxY, 490, boxH, 4).fillColor(C.yellow50).fill();
  doc.roundedRect(55, boxY, 3, boxH, 1).fillColor(C.warning).fill();
  doc.font(FONT_BOLD).fontSize(9.5).fillColor(C.warning).text('NOTE', 70, boxY + 6);
  doc.font(FONT_PATH).fontSize(9.5).fillColor(C.gray800).text(text, 108, boxY + 6, { width: textWidth, lineGap: 2 });
  doc.y = boxY + boxH + 4;
  return doc;
}

function spacer(doc, h = 8) {
  doc.y += h;
  return doc;
}

// Cover page
function coverPage(doc, title, subtitle, version) {
  // Background
  doc.rect(0, 0, 595, 842).fillColor(C.primary).fill();

  // Accent bar
  doc.rect(0, 320, 595, 6).fillColor(C.accent).fill();

  // Logo
  doc.font(FONT_BOLD).fontSize(42).fillColor(C.white).text('SureOdds', 50, 180, { align: 'center' });
  doc.font(FONT_PATH).fontSize(14).fillColor('#93C5FD').text('\uC2A4\uD3EC\uCE20 \uC591\uBC29 \uD0D0\uC9C0 \uD50C\uB7AB\uD3FC', 50, 235, { align: 'center' });

  // Title
  doc.font(FONT_BOLD).fontSize(28).fillColor(C.white).text(title, 50, 370, { align: 'center' });
  doc.font(FONT_PATH).fontSize(14).fillColor('#BFDBFE').text(subtitle, 50, 415, { align: 'center' });

  // Footer
  doc.font(FONT_PATH).fontSize(11).fillColor('#93C5FD').text(`Version ${version}`, 50, 720, { align: 'center' });
  doc.font(FONT_PATH).fontSize(10).fillColor('#93C5FD').text('2026.03', 50, 740, { align: 'center' });
}

// Table of contents
function tocPage(doc, items) {
  pageHeader(doc, '\uBAA9\uCC28');
  spacer(doc, 10);
  items.forEach((item, i) => {
    const y = doc.y + 4;
    if (y > 720) { doc.addPage(); doc.y = 60; }
    doc.font(FONT_BOLD).fontSize(11).fillColor(C.primary).text(`${i + 1}.`, 55, y);
    doc.font(FONT_PATH).fontSize(11).fillColor(C.dark).text(item.title, 75, y);
    doc.font(FONT_PATH).fontSize(10).fillColor(C.secondary).text(`${item.page}`, 520, y, { width: 25, align: 'right' });
    // dotted line
    const textW = doc.widthOfString(item.title);
    const lineStart = 80 + textW;
    const lineEnd = 515;
    if (lineEnd > lineStart + 10) {
      doc.font(FONT_PATH).fontSize(10).fillColor(C.gray200).text('.'.repeat(Math.floor((lineEnd - lineStart) / 4)), lineStart, y, { width: lineEnd - lineStart });
    }
    doc.y = y + 12;
  });
}

// Footer on each page
function addFooters(doc, title) {
  const pages = doc.bufferedPageRange();
  for (let i = 1; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.font(FONT_PATH).fontSize(8).fillColor(C.secondary)
      .text(`SureOdds - ${title}`, 50, 805, { width: 495, align: 'left' })
      .text(`${i + 1}`, 50, 805, { width: 495, align: 'right' });
    doc.moveTo(50, 800).lineTo(545, 800).strokeColor(C.gray200).lineWidth(0.5).stroke();
  }
}


// ============================================================
// USER GUIDE
// ============================================================
function generateUserGuide() {
  const { doc, stream } = createDoc('E:/00_Work/02_LineMiniApp/SureOdds/SureOdds_User_Guide.pdf');
  doc.registerFont('Korean', FONT_PATH);
  doc.registerFont('KoreanBold', FONT_BOLD);

  // Cover
  coverPage(doc, '\uC720\uC800 \uAC00\uC774\uB4DC', '\uD68C\uC6D0\uC6A9 \uC0AC\uC6A9 \uC124\uBA85\uC11C', '2.0');

  // TOC
  const tocItems = [
    { title: '\uB85C\uADF8\uC778', page: 3 },
    { title: '\uB300\uC2DC\uBCF4\uB4DC \u2014 \uC591\uBC29 \uAE30\uD68C \uD0D0\uC0C9', page: 4 },
    { title: '\uD544\uD130 \uD65C\uC6A9\uD558\uAE30', page: 6 },
    { title: '\uACBD\uAE30 \uC0C1\uC138 \uD328\uB110', page: 7 },
    { title: '\uBC30\uD305 \uACC4\uC0B0\uAE30', page: 8 },
    { title: '\uAD6D\uB0B4 \uC0AC\uC774\uD2B8 \uAD00\uB9AC', page: 9 },
    { title: '\uC54C\uB9BC \uC124\uC815 \uBC0F \uD154\uB808\uADF8\uB7A8 \uC5F0\uB3D9', page: 11 },
    { title: '\uC790\uC8FC \uBB3B\uB294 \uC9C8\uBB38 (FAQ)', page: 13 },
  ];
  tocPage(doc, tocItems);

  // ---- Page: Login ----
  pageHeader(doc, '1. \uB85C\uADF8\uC778');
  para(doc, '\uAD00\uB9AC\uC790\uB85C\uBD80\uD130 \uBC1C\uAE09\uBC1B\uC740 \uC544\uC774\uB514\uC640 \uBE44\uBC00\uBC88\uD638\uB85C \uB85C\uADF8\uC778\uD569\uB2C8\uB2E4.');
  spacer(doc);
  numberedItem(doc, 1, '\uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uC0AC\uC774\uD2B8 \uC8FC\uC18C\uC5D0 \uC811\uC18D\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 2, '"\uC544\uC774\uB514 \uB610\uB294 \uC774\uBA54\uC77C" \uD544\uB4DC\uC5D0 \uBC1C\uAE09\uBC1B\uC740 \uC544\uC774\uB514\uB97C \uC785\uB825\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 3, '"\uBE44\uBC00\uBC88\uD638" \uD544\uB4DC\uC5D0 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 4, '"\uB85C\uADF8\uC778" \uBC84\uD2BC\uC744 \uD074\uB9AD\uD558\uBA74 \uB300\uC2DC\uBCF4\uB4DC\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4.');
  spacer(doc);
  warnBox(doc, '\uD68C\uC6D0\uAC00\uC785\uC740 \uAD00\uB9AC\uC790\uC5D0\uAC8C \uBB38\uC758\uD574\uC57C \uD569\uB2C8\uB2E4. \uC790\uCCB4 \uAC00\uC785\uC740 \uC9C0\uC6D0\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.');

  // ---- Page: Dashboard ----
  pageHeader(doc, '2. \uB300\uC2DC\uBCF4\uB4DC \u2014 \uC591\uBC29 \uAE30\uD68C \uD0D0\uC0C9');
  para(doc, '\uB300\uC2DC\uBCF4\uB4DC\uB294 SureOdds\uC758 \uD575\uC2EC \uD654\uBA74\uC73C\uB85C, \uC2E4\uC2DC\uAC04 \uC591\uBC29 \uAE30\uD68C\uB97C \uD0D0\uC0C9\uD558\uB294 \uACF3\uC785\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uD654\uBA74 \uAD6C\uC131');
  bullet(doc, '\uC0C1\uB2E8 \uD234\uBC14: \uD544\uD130, \uD1B5\uACC4, \uC0C8\uB85C\uACE0\uCE68 \uBC84\uD2BC');
  bullet(doc, '\uC911\uC559 \uD14C\uC774\uBE14: \uACBD\uAE30 \uBAA9\uB85D (\uBAA8\uBC14\uC77C\uC5D0\uC11C\uB294 \uCE74\uB4DC \uD615\uD0DC)');
  bullet(doc, '\uD558\uB2E8 \uD328\uB110: \uC120\uD0DD\uD55C \uACBD\uAE30\uC758 \uC0C1\uC138 \uBC30\uB2F9 \uC815\uBCF4');
  spacer(doc);

  sectionTitle(doc, '\uD1B5\uACC4 \uC815\uBCF4');
  bullet(doc, '\uACBD\uAE30: \uD604\uC7AC \uC218\uC9D1\uB41C \uCD1D \uACBD\uAE30 \uC218');
  bullet(doc, '\uC591\uBC29: \uD0D0\uC9C0\uB41C \uC591\uBC29 \uAE30\uD68C \uC218 (\uCD08\uB85D\uC0C9 \uD45C\uC2DC)');
  bullet(doc, '\uCD5C\uACE0: \uAC00\uC7A5 \uB192\uC740 \uC218\uC775\uB960');
  spacer(doc);

  sectionTitle(doc, '\uACBD\uAE30 \uBAA9\uB85D \uC77D\uB294 \uBC95');
  para(doc, '\uAC01 \uACBD\uAE30 \uD589(\uB610\uB294 \uBAA8\uBC14\uC77C \uCE74\uB4DC)\uC5D0\uB294 \uB2E4\uC74C \uC815\uBCF4\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4:');
  bullet(doc, '\uB9AC\uADF8\uBA85 \uBC0F \uACBD\uAE30 \uC2DC\uAC04');
  bullet(doc, '\uD648\uD300 vs \uC6D0\uC815\uD300');
  bullet(doc, '\uB9C8\uCF13 \uC720\uD615 \uBC30\uC9C0 \u2014 1X2(\uD30C\uB780), \uD578\uB514\uCEA1(\uBCF4\uB77C), \uC624\uBC84/\uC5B8\uB354(\uC8FC\uD669)');
  bullet(doc, '\uCD5C\uACE0 \uBC30\uB2F9\uACFC \uBD81\uBA54\uC774\uCEE4\uBA85');
  bullet(doc, '\uC218\uC775\uB960 (%) \u2014 \uC591\uC218\uC774\uBA74 \uCD08\uB85D\uC0C9, \uC74C\uC218\uBA74 \uD68C\uC0C9');
  spacer(doc);
  tipBox(doc, '\uACBD\uAE30 \uD589\uC744 \uD074\uB9AD\uD558\uBA74 \uD558\uB2E8\uC5D0 \uC0C1\uC138 \uD328\uB110\uC774 \uC5F4\uB9BD\uB2C8\uB2E4. \uBAA8\uB4E0 \uBD81\uBA54\uC774\uCEE4\uC758 \uBC30\uB2F9\uC744 \uBE44\uAD50\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');

  sectionTitle(doc, '\uC0C8\uB85C\uACE0\uCE68');
  para(doc, '\uD234\uBC14 \uC6B0\uCE21\uC758 "\uC0C8\uB85C\uACE0\uCE68" \uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uCD5C\uC2E0 \uBC30\uB2F9 \uB370\uC774\uD130\uB97C \uC218\uC9D1\uD558\uACE0 \uD654\uBA74\uC744 \uAC31\uC2E0\uD569\uB2C8\uB2E4.');
  para(doc, '\uBC30\uB2F9 \uC218\uC9D1\uC740 \uC790\uB3D9\uC73C\uB85C 10\uBD84\uB9C8\uB2E4 \uC2E4\uD589\uB418\uBA70, \uD234\uBC14\uC5D0 \uB9C8\uC9C0\uB9C9 \uC218\uC9D1 \uC2DC\uAC04\uC774 \uD45C\uC2DC\uB429\uB2C8\uB2E4.');

  // ---- Page: Filters ----
  pageHeader(doc, '3. \uD544\uD130 \uD65C\uC6A9\uD558\uAE30');
  para(doc, '\uB300\uC2DC\uBCF4\uB4DC \uC0C1\uB2E8 \uD234\uBC14\uC5D0\uC11C \uB2E4\uC591\uD55C \uD544\uD130\uB97C \uC801\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  spacer(doc);

  subTitle(doc, '\uC885\uBAA9 \uD544\uD130');
  para(doc, '\uC804\uCCB4, \uCD95\uAD6C, \uB18D\uAD6C, \uC57C\uAD6C, \uD558\uD0A4 \uC911 \uC6D0\uD558\uB294 \uC885\uBAA9\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4. \uBCF5\uC218 \uC120\uD0DD \uAC00\uB2A5\uD569\uB2C8\uB2E4.');
  spacer(doc);

  subTitle(doc, '\uB9C8\uCF13 \uC720\uD615 \uD544\uD130');
  bullet(doc, '1X2: \uC2B9\uBD80\uC2DD (\uD648\uC2B9/\uBB34\uC2B9\uBD80/\uC6D0\uC815\uC2B9)');
  bullet(doc, '\uD578\uB514\uCEA1: \uD578\uB514\uCEA1 \uBC30\uB2F9');
  bullet(doc, '\uC624\uBC84/\uC5B8\uB354: \uCD1D \uB4DD\uC810 \uBC30\uB2F9');
  spacer(doc);

  subTitle(doc, '\uBC30\uB2F9 \uCD9C\uCC98 \uD544\uD130');
  bullet(doc, '\uD574\uC678: \uD574\uC678 \uBD81\uBA54\uC774\uCEE4 \uBC30\uB2F9\uB9CC \uD45C\uC2DC');
  bullet(doc, '\uAD6D\uB0B4: \uAD6D\uB0B4 \uC0AC\uC124/\uBCA0\uD2B8\uB9E8 \uBC30\uB2F9\uB9CC \uD45C\uC2DC');
  bullet(doc, '\uD63C\uD569: \uD574\uC678+\uAD6D\uB0B4 \uD63C\uD569 \uC591\uBC29 \uAE30\uD68C \uD45C\uC2DC');
  spacer(doc);

  subTitle(doc, '\uBD81\uBA54\uC774\uCEE4 \uD544\uD130');
  para(doc, '\uD2B9\uC815 \uBD81\uBA54\uC774\uCEE4\uB97C \uC120\uD0DD/\uC81C\uC678\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  spacer(doc);

  subTitle(doc, '\uCD5C\uC18C \uC218\uC775\uB960');
  para(doc, '\uC124\uC815\uD55C \uC218\uC775\uB960 \uC774\uC0C1\uC758 \uACBD\uAE30\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uAE30\uBCF8\uAC12\uC740 0%\uC785\uB2C8\uB2E4.');
  spacer(doc);

  subTitle(doc, '\uC815\uB82C');
  bullet(doc, '\uC218\uC775\uB960\uC21C: \uB192\uC740 \uC218\uC775\uB960 \uACBD\uAE30\uAC00 \uC0C1\uB2E8\uC5D0 \uD45C\uC2DC (\uAE30\uBCF8)');
  bullet(doc, '\uC2DC\uAC04\uC21C: \uACBD\uAE30 \uC2DC\uC791 \uC2DC\uAC04\uC21C\uC73C\uB85C \uC815\uB82C');
  spacer(doc);
  tipBox(doc, '\uD544\uD130 \uC870\uD569\uC744 \uC798 \uD65C\uC6A9\uD558\uBA74 \uC6D0\uD558\uB294 \uC591\uBC29 \uAE30\uD68C\uB97C \uBE60\uB974\uAC8C \uCC3E\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');

  // ---- Page: Detail Panel ----
  pageHeader(doc, '4. \uACBD\uAE30 \uC0C1\uC138 \uD328\uB110');
  para(doc, '\uACBD\uAE30\uB97C \uD074\uB9AD\uD558\uBA74 \uD654\uBA74 \uD558\uB2E8\uC5D0 \uC0C1\uC138 \uD328\uB110\uC774 \uC5F4\uB9BD\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uD328\uB110 \uAD6C\uC131');
  bullet(doc, '\uB9C8\uCF13 \uD0ED (1X2, \uD578\uB514\uCEA1, \uC624\uBC84/\uC5B8\uB354) \u2014 \uD574\uB2F9 \uACBD\uAE30\uC5D0\uC11C \uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uD0ED\uB9CC \uD65C\uC131\uD654');
  bullet(doc, '\uBD81\uBA54\uC774\uCEE4\uBCC4 \uBC30\uB2F9 \uD14C\uC774\uBE14 \u2014 \uCD5C\uACE0 \uBC30\uB2F9\uC740 \uCD08\uB85D\uC0C9 \uAC15\uC870');
  bullet(doc, '\uCD5C\uC801 \uC870\uD569 \uD45C\uC2DC \u2014 \uAC00\uC7A5 \uB192\uC740 \uBC30\uB2F9 \uC870\uD569\uACFC \uC591\uBC29 \uACC4\uC218(Arb)');
  bullet(doc, '\uC591\uBC29 \uAE30\uD68C \uD0D0\uC9C0 \uC54C\uB9BC \u2014 \uC218\uC775\uB960\uC774 \uC591\uC218\uC77C \uB54C \uD45C\uC2DC');
  spacer(doc);

  sectionTitle(doc, '\uBC30\uBD84 \uACC4\uC0B0 \uBC84\uD2BC');
  para(doc, '\uC0C1\uC138 \uD328\uB110\uC5D0\uC11C "\uBC30\uBD84 \uACC4\uC0B0" \uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uD574\uB2F9 \uBC30\uB2F9\uC774 \uC790\uB3D9\uC73C\uB85C \uACC4\uC0B0\uAE30\uC5D0 \uC785\uB825\uB429\uB2C8\uB2E4.');
  spacer(doc);
  tipBox(doc, '\uD578\uB514\uCEA1/\uC624\uBC84\uC5B8\uB354\uB294 \uB4DC\uB86D\uB2E4\uC6B4\uC73C\uB85C \uD3EC\uC778\uD2B8\uB97C \uBCC0\uACBD\uD558\uBA74 \uB2E4\uB978 \uD578\uB514\uCEA1 \uB77C\uC778\uC758 \uBC30\uB2F9\uB3C4 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');

  // ---- Page: Calculator ----
  pageHeader(doc, '5. \uBC30\uD305 \uACC4\uC0B0\uAE30');
  para(doc, '\uC591\uBC29 \uBC30\uD305 \uC2DC \uAC01 \uACB0\uACFC\uC5D0 \uC5BC\uB9C8\uB97C \uD22C\uC790\uD574\uC57C \uBCF4\uC7A5 \uC218\uC775\uC744 \uC5BB\uC744 \uC218 \uC788\uB294\uC9C0 \uACC4\uC0B0\uD569\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uC0AC\uC6A9\uBC95');
  numberedItem(doc, 1, '\uB9C8\uCF13 \uC720\uD615\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4 (1X2, \uD578\uB514\uCEA1, \uC624\uBC84/\uC5B8\uB354).');
  numberedItem(doc, 2, '1X2\uB294 2-way(\uBB34\uC2B9\uBD80 \uC5C6\uC74C) \uB610\uB294 3-way(\uBB34\uC2B9\uBD80 \uC788\uC74C)\uB97C \uC120\uD0DD\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 3, '\uAC01 \uACB0\uACFC\uC758 \uBC30\uB2F9\uC744 \uC18C\uC218\uC810 \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 4, '\uCD1D \uD22C\uC790\uAE08\uC744 \uC6D0(\u20A9) \uB2E8\uC704\uB85C \uC785\uB825\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 5, '"\uBC30\uBD84 \uACC4\uC0B0" \uBC84\uD2BC\uC744 \uB204\uB985\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uACB0\uACFC \uD574\uC11D');
  bullet(doc, '\uC591\uBC29 \uACC4\uC218: 1.0 \uBBF8\uB9CC\uC774\uBA74 \uC591\uBC29 \uAE30\uD68C');
  bullet(doc, '\uC608\uC0C1 \uC218\uC775\uB960: \uBCF4\uC7A5 \uC218\uC775 \uBE44\uC728');
  bullet(doc, '\uACB0\uACFC\uBCC4 \uC2A4\uD14C\uC774\uD06C: \uAC01 \uACB0\uACFC\uC5D0 \uBC30\uD305\uD560 \uAE08\uC561');
  bullet(doc, '\uBCF4\uC7A5 \uD68C\uC218\uAE08: \uC5B4\uB5A4 \uACB0\uACFC\uB77C\uB3C4 \uBC18\uB4DC\uC2DC \uBC1B\uB294 \uCD5C\uC18C \uAE08\uC561');
  spacer(doc);
  warnBox(doc, '\uC591\uBC29 \uACC4\uC218\uAC00 1.0 \uC774\uC0C1\uC774\uBA74 \uC591\uBC29\uC774 \uC544\uB2C8\uBA70 \uC190\uC2E4\uC774 \uBC1C\uC0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uD654\uBA74\uC5D0 \uACBD\uACE0 \uBA54\uC2DC\uC9C0\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.');
  spacer(doc);
  tipBox(doc, '\uB300\uC2DC\uBCF4\uB4DC\uC5D0\uC11C "\uBC30\uBD84 \uACC4\uC0B0" \uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uBC30\uB2F9\uC774 \uC790\uB3D9 \uC785\uB825\uB418\uC5B4 \uD3B8\uB9AC\uD569\uB2C8\uB2E4.');

  // ---- Page: Domestic ----
  pageHeader(doc, '6. \uAD6D\uB0B4 \uC0AC\uC774\uD2B8 \uAD00\uB9AC');
  para(doc, '\uAD6D\uB0B4 \uC0AC\uC124 \uC0AC\uC774\uD2B8\uC758 \uBC30\uB2F9\uC744 \uB4F1\uB85D\uD558\uACE0 \uAD00\uB9AC\uD558\uB294 \uD398\uC774\uC9C0\uC785\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uC0AC\uC774\uD2B8 \uB4F1\uB85D');
  numberedItem(doc, 1, '"\uC0AC\uC774\uD2B8 \uC120\uD0DD" \uB4DC\uB86D\uB2E4\uC6B4\uC5D0\uC11C \uC6D0\uD558\uB294 \uC0AC\uC774\uD2B8\uB97C \uC120\uD0DD\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 2, '\uD574\uB2F9 \uC0AC\uC774\uD2B8\uC758 \uC544\uC774\uB514/\uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 3, '\uC218\uC9D1\uD560 \uB9C8\uCF13 \uC720\uD615(\uD06C\uB85C\uC2A4, \uD578\uB514, O/U)\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 4, '"\uC0AC\uC774\uD2B8 \uCD94\uAC00" \uBC84\uD2BC\uC744 \uB204\uB985\uB2C8\uB2E4.');
  spacer(doc);
  infoBox(doc, '\uBCF4\uC548 \uC548\uB0B4', '\uBE44\uBC00\uBC88\uD638\uB294 AES-256 \uC554\uD638\uD654\uB418\uC5B4 \uC548\uC804\uD558\uAC8C \uC800\uC7A5\uB429\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uC0AC\uC774\uD2B8 \uAD00\uB9AC');
  bullet(doc, '\uB4F1\uB85D\uB41C \uC0AC\uC774\uD2B8 \uBAA9\uB85D\uC5D0\uC11C \uC0C1\uD0DC, \uB9C8\uCF13 \uC720\uD615, \uC2B9\uC778 \uC0C1\uD0DC\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  bullet(doc, '\uD3B8\uC9D1(\u270F) \uBC84\uD2BC\uC73C\uB85C \uC544\uC774\uB514/\uBE44\uBC00\uBC88\uD638/\uB9C8\uCF13 \uC720\uD615\uC744 \uC218\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  bullet(doc, '\uC0AD\uC81C(\u2715) \uBC84\uD2BC\uC73C\uB85C \uB4F1\uB85D\uC744 \uD574\uC81C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uC0AC\uC774\uD2B8 \uC791\uC5C5 \uC694\uCCAD');
  para(doc, '\uBAA9\uB85D\uC5D0 \uC5C6\uB294 \uC0C8\uB85C\uC6B4 \uC0AC\uC774\uD2B8\uB97C \uCD94\uAC00\uD558\uACE0 \uC2F6\uB2E4\uBA74 \uC791\uC5C5 \uC694\uCCAD\uC744 \uBCF4\uB0BC \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  numberedItem(doc, 1, '\uC0AC\uC774\uD2B8 URL\uC744 \uC785\uB825\uD569\uB2C8\uB2E4 (\uD544\uC218).');
  numberedItem(doc, 2, '\uC0AC\uC774\uD2B8\uBA85\uACFC \uAE30\uD0C0\uC0AC\uD56D\uC744 \uC785\uB825\uD569\uB2C8\uB2E4 (\uC120\uD0DD).');
  numberedItem(doc, 3, '"\uC791\uC5C5\uC694\uCCAD\uD558\uAE30" \uBC84\uD2BC\uC744 \uB204\uB985\uB2C8\uB2E4.');
  para(doc, '\uAD00\uB9AC\uC790 \uD655\uC778 \uD6C4 \uD06C\uB864\uB7EC\uAC00 \uC138\uD305\uB418\uBA74 "\uB098\uC758 \uC694\uCCAD \uB0B4\uC5ED"\uC5D0\uC11C \uC0C1\uD0DC\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');

  // ---- Page: Alert ----
  pageHeader(doc, '7. \uC54C\uB9BC \uC124\uC815 \uBC0F \uD154\uB808\uADF8\uB7A8 \uC5F0\uB3D9');
  para(doc, '\uC591\uBC29 \uAE30\uD68C\uAC00 \uD0D0\uC9C0\uB418\uBA74 \uC54C\uB9BC\uC744 \uBC1B\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uD234\uBC14 \uC6B0\uCE21\uC758 \uC54C\uB9BC \uC544\uC774\uCF58\uC744 \uD074\uB9AD\uD558\uC138\uC694.');
  spacer(doc);

  sectionTitle(doc, '\uC54C\uB9BC \uC885\uB958');
  bullet(doc, '\uC18C\uB9AC \uC54C\uB9BC: \uBE14\uB77C\uC6B0\uC800\uC5D0\uC11C \uBE44\uD504\uC74C\uC73C\uB85C \uC54C\uB824\uC90D\uB2C8\uB2E4. "\uD14C\uC2A4\uD2B8" \uBC84\uD2BC\uC73C\uB85C \uC18C\uB9AC\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  bullet(doc, '\uBE0C\uB77C\uC6B0\uC800 \uC54C\uB9BC: \uBC14\uD0D5 \uD654\uBA74/\uB2E4\uB978 \uD0ED\uC5D0\uC11C\uB3C4 \uD478\uC2DC \uC54C\uB9BC\uC73C\uB85C \uC54C\uB824\uC90D\uB2C8\uB2E4.');
  bullet(doc, '\uD154\uB808\uADF8\uB7A8 DM \uC54C\uB9BC: \uD154\uB808\uADF8\uB7A8\uC73C\uB85C \uAC1C\uC778 \uBA54\uC2DC\uC9C0\uB97C \uBC1B\uC2B5\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uC54C\uB9BC \uAE30\uC900 \uC218\uC775\uB960');
  para(doc, '\uC124\uC815\uD55C \uC218\uC775\uB960 \uC774\uC0C1\uC758 \uAE30\uD68C\uAC00 \uD0D0\uC9C0\uB420 \uB54C\uB9CC \uC54C\uB9BC\uC774 \uBC1C\uC1A1\uB429\uB2C8\uB2E4.');
  bullet(doc, '\uBCF4\uD1B5 / \uB192\uC74C / \uB9E4\uC6B0 \uB192\uC74C \uB2E8\uACC4\uB85C \uC124\uC815 \uAC00\uB2A5');
  spacer(doc);

  sectionTitle(doc, '\uD154\uB808\uADF8\uB7A8 \uC5F0\uB3D9 \uBC29\uBC95');
  spacer(doc, 4);
  numberedItem(doc, 1, '\uC54C\uB9BC \uC124\uC815 \uD654\uBA74\uC5D0\uC11C "\uD154\uB808\uADF8\uB7A8 \uC5F0\uB3D9\uD558\uAE30" \uBC84\uD2BC\uC744 \uD074\uB9AD\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 2, '\uD45C\uC2DC\uB418\uB294 \uB9C1\uD06C\uB97C \uD074\uB9AD\uD558\uBA74 \uD154\uB808\uADF8\uB7A8 \uC571\uC774 \uC5F4\uB9BD\uB2C8\uB2E4.');
  numberedItem(doc, 3, '\uD154\uB808\uADF8\uB7A8\uC5D0\uC11C "\uC2DC\uC791" \uBC84\uD2BC\uC744 \uB204\uB985\uB2C8\uB2E4.');
  numberedItem(doc, 4, '\uC790\uB3D9\uC73C\uB85C \uC5F0\uB3D9\uC774 \uC644\uB8CC\uB418\uACE0 \uD655\uC778 \uBA54\uC2DC\uC9C0\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.');
  spacer(doc);
  para(doc, '\uC5F0\uB3D9\uC774 \uC644\uB8CC\uB418\uBA74 "\uC5F0\uB3D9\uB428" \uC0C1\uD0DC\uC640 \uC5F0\uB3D9 \uB0A0\uC9DC\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.');
  para(doc, '\uC5F0\uB3D9\uC744 \uD574\uC81C\uD558\uB824\uBA74 "\uC5F0\uB3D9 \uD574\uC81C" \uBC84\uD2BC\uC744 \uD074\uB9AD\uD558\uC138\uC694.');
  spacer(doc);
  tipBox(doc, '\uD154\uB808\uADF8\uB7A8 \uC5F0\uB3D9 \uD6C4\uC5D0\uB294 \uC0AC\uC774\uD2B8\uC5D0 \uC811\uC18D\uD558\uC9C0 \uC54A\uC544\uB3C4 \uC591\uBC29 \uC54C\uB9BC\uC744 \uBC1B\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');

  // ---- Page: FAQ ----
  pageHeader(doc, '8. \uC790\uC8FC \uBB3B\uB294 \uC9C8\uBB38 (FAQ)');
  spacer(doc);

  subTitle(doc, 'Q. \uC591\uBC29(\uC544\uBE44\uD2B8\uB77C\uC9C0)\uC774\uB780 \uBB34\uC5C7\uC778\uAC00\uC694?');
  para(doc, '\uC11C\uB85C \uB2E4\uB978 \uBD81\uBA54\uC774\uCEE4\uC758 \uBC30\uB2F9 \uCC28\uC774\uB97C \uC774\uC6A9\uD558\uC5EC \uBAA8\uB4E0 \uACB0\uACFC\uC5D0 \uBC30\uD305\uD558\uACE0 \uACB0\uACFC\uC5D0 \uAD00\uACC4\uC5C6\uC774 \uBCF4\uC7A5 \uC218\uC775\uC744 \uC5BB\uB294 \uBC29\uBC95\uC785\uB2C8\uB2E4.');
  spacer(doc, 6);

  subTitle(doc, 'Q. \uC218\uC775\uB960\uC774 \uB9C8\uC774\uB108\uC2A4(\uC74C\uC218)\uC778 \uACBD\uAE30\uB3C4 \uBCF4\uC774\uB294\uB370\uC694?');
  para(doc, '\uAE30\uBCF8\uC801\uC73C\uB85C \uBAA8\uB4E0 \uACBD\uAE30\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4. "\uCD5C\uC18C \uC218\uC775\uB960" \uD544\uD130\uB97C 0% \uC774\uC0C1\uC73C\uB85C \uC124\uC815\uD558\uBA74 \uC591\uBC29 \uAE30\uD68C\uB9CC \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  spacer(doc, 6);

  subTitle(doc, 'Q. \uBC30\uB2F9\uC740 \uC5BC\uB9C8\uB098 \uC790\uC8FC \uC5C5\uB370\uC774\uD2B8\uB418\uB098\uC694?');
  para(doc, '\uC790\uB3D9\uC73C\uB85C 10\uBD84\uB9C8\uB2E4 \uC218\uC9D1\uB429\uB2C8\uB2E4. "\uC0C8\uB85C\uACE0\uCE68" \uBC84\uD2BC\uC73C\uB85C \uC988\uC2DC \uC218\uB3D9 \uC218\uC9D1\uB3C4 \uAC00\uB2A5\uD569\uB2C8\uB2E4.');
  spacer(doc, 6);

  subTitle(doc, 'Q. \uD154\uB808\uADF8\uB7A8 \uC54C\uB9BC\uC774 \uC624\uC9C0 \uC54A\uC544\uC694.');
  para(doc, '\uC54C\uB9BC \uC124\uC815\uC5D0\uC11C \uD154\uB808\uADF8\uB7A8\uC774 "\uC5F0\uB3D9\uB428" \uC0C1\uD0DC\uC778\uC9C0 \uD655\uC778\uD558\uC138\uC694. \uBD07\uC744 \uCC28\uB2E8\uD55C \uACBD\uC6B0 \uC790\uB3D9\uC73C\uB85C \uC5F0\uB3D9\uC774 \uD574\uC81C\uB429\uB2C8\uB2E4. \uB2E4\uC2DC \uC5F0\uB3D9\uD574\uC8FC\uC138\uC694.');
  spacer(doc, 6);

  subTitle(doc, 'Q. \uBE44\uBC00\uBC88\uD638\uB97C \uBCC0\uACBD\uD558\uACE0 \uC2F6\uC2B5\uB2C8\uB2E4.');
  para(doc, '\uAD00\uB9AC\uC790\uC5D0\uAC8C \uBB38\uC758\uD558\uC5EC \uBE44\uBC00\uBC88\uD638 \uCD08\uAE30\uD654\uB97C \uC694\uCCAD\uD574\uC8FC\uC138\uC694.');

  // Add footers
  addFooters(doc, '\uC720\uC800 \uAC00\uC774\uB4DC');

  doc.end();
  return new Promise(resolve => stream.on('finish', resolve));
}


// ============================================================
// ADMIN GUIDE
// ============================================================
function generateAdminGuide() {
  const { doc, stream } = createDoc('E:/00_Work/02_LineMiniApp/SureOdds/SureOdds_Admin_Guide.pdf');
  doc.registerFont('Korean', FONT_PATH);
  doc.registerFont('KoreanBold', FONT_BOLD);

  // Cover
  coverPage(doc, '\uAD00\uB9AC\uC790 \uAC00\uC774\uB4DC', '\uC6B4\uC601\uC790\uC6A9 \uC0AC\uC6A9 \uC124\uBA85\uC11C', '2.0');

  // TOC
  const tocItems = [
    { title: '\uAD00\uB9AC\uC790 \uB85C\uADF8\uC778', page: 3 },
    { title: '\uD68C\uC6D0 \uAD00\uB9AC', page: 4 },
    { title: '\uC0AC\uC774\uD2B8 \uAD00\uB9AC', page: 6 },
    { title: '\uC791\uC5C5 \uC694\uCCAD \uAD00\uB9AC', page: 8 },
    { title: '\uBCA0\uD2B8\uB9E8 \uD06C\uB864\uB9C1', page: 9 },
    { title: '\uD154\uB808\uADF8\uB7A8 \uC54C\uB9BC \uC2DC\uC2A4\uD15C', page: 10 },
    { title: '\uC6B4\uC601 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8', page: 11 },
  ];
  tocPage(doc, tocItems);

  // ---- Page: Admin Login ----
  pageHeader(doc, '1. \uAD00\uB9AC\uC790 \uB85C\uADF8\uC778');
  para(doc, '\uAD00\uB9AC\uC790\uB294 \uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB85C \uB85C\uADF8\uC778\uD569\uB2C8\uB2E4. (\uC77C\uBC18 \uD68C\uC6D0\uC740 \uC544\uC774\uB514\uB85C \uB85C\uADF8\uC778)');
  spacer(doc);
  para(doc, '\uB85C\uADF8\uC778 \uD6C4 \uD558\uB2E8 \uB124\uBE44\uAC8C\uC774\uC158\uC5D0 "\uAD00\uB9AC\uC790" \uBA54\uB274\uAC00 \uCD94\uAC00\uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4.');
  spacer(doc);
  infoBox(doc, '\uAD00\uB9AC\uC790 \uC804\uC6A9 \uAE30\uB2A5', '\uD68C\uC6D0 \uC0DD\uC131/\uAD00\uB9AC, \uC0AC\uC774\uD2B8 \uB9C8\uC2A4\uD130 \uBAA9\uB85D \uAD00\uB9AC, \uC0AC\uC6A9\uC790 \uB4F1\uB85D \uC0AC\uC774\uD2B8 \uAD00\uB9AC, \uC791\uC5C5\uC694\uCCAD \uCC98\uB9AC, \uBCA0\uD2B8\uB9E8 \uD06C\uB864\uB9C1');

  // ---- Page: User Management ----
  pageHeader(doc, '2. \uD68C\uC6D0 \uAD00\uB9AC');
  para(doc, '\uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC758 "\uD68C\uC6D0 \uAD00\uB9AC" \uD0ED\uC5D0\uC11C \uD68C\uC6D0\uC744 \uAD00\uB9AC\uD569\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uC0C8 \uD68C\uC6D0 \uC0DD\uC131');
  numberedItem(doc, 1, '"\uC0C8 \uD68C\uC6D0" \uBC84\uD2BC\uC744 \uD074\uB9AD\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 2, '\uC5ED\uD560\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4 (\uC77C\uBC18 \uC0AC\uC6A9\uC790 \uB610\uB294 \uAD00\uB9AC\uC790).');
  numberedItem(doc, 3, '\uC77C\uBC18 \uC0AC\uC6A9\uC790: \uC544\uC774\uB514 + \uBE44\uBC00\uBC88\uD638 + \uC774\uB984(\uC120\uD0DD) \uC785\uB825');
  numberedItem(doc, 4, '\uAD00\uB9AC\uC790: \uC774\uBA54\uC77C + \uBE44\uBC00\uBC88\uD638 + \uC774\uB984(\uC120\uD0DD) \uC785\uB825');
  numberedItem(doc, 5, '"\uD68C\uC6D0 \uC0DD\uC131" \uBC84\uD2BC\uC744 \uD074\uB9AD\uD569\uB2C8\uB2E4.');
  spacer(doc);
  infoBox(doc, '\uC785\uB825 \uADDC\uCE59', '\uC544\uC774\uB514: \uC601\uBB38/\uC22B\uC790/\uBC11\uC904 3~20\uC790 | \uBE44\uBC00\uBC88\uD638: \uCD5C\uC18C 6\uC790 | \uC774\uBA54\uC77C: \uC720\uD6A8\uD55C \uC774\uBA54\uC77C \uD615\uC2DD');
  spacer(doc);

  sectionTitle(doc, '\uD68C\uC6D0 \uBAA9\uB85D');
  para(doc, '\uB4F1\uB85D\uB41C \uBAA8\uB4E0 \uD68C\uC6D0\uC758 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4:');
  bullet(doc, '\uC544\uC774\uB514/\uC774\uBA54\uC77C, \uC774\uB984, \uC5ED\uD560(\uC0AC\uC6A9\uC790/\uAD00\uB9AC\uC790)');
  bullet(doc, '\uC0C1\uD0DC (\uD65C\uC131/\uBE44\uD65C\uC131) \u2014 \uD1A0\uAE00 \uAC00\uB2A5');
  bullet(doc, '\uAC00\uC785\uC77C, \uCD5C\uADFC \uC811\uC18D\uC77C');
  bullet(doc, '\uD154\uB808\uADF8\uB7A8 \uC5F0\uB3D9 \uC5EC\uBD80 (\uD3F0 \uC544\uC774\uCF58 \uD45C\uC2DC)');
  spacer(doc);

  sectionTitle(doc, '\uD68C\uC6D0 \uAD00\uB9AC \uAE30\uB2A5');
  bullet(doc, '\uBE44\uD65C\uC131\uD654: \uD68C\uC6D0\uC758 \uB85C\uADF8\uC778\uC744 \uCC28\uB2E8\uD569\uB2C8\uB2E4. \uB370\uC774\uD130\uB294 \uC720\uC9C0\uB429\uB2C8\uB2E4.');
  bullet(doc, '\uD65C\uC131\uD654: \uBE44\uD65C\uC131\uD654\uB41C \uD68C\uC6D0\uC744 \uB2E4\uC2DC \uD65C\uC131\uD654\uD569\uB2C8\uB2E4.');
  bullet(doc, '\uC0AD\uC81C: \uD68C\uC6D0\uC744 \uC644\uC804\uD788 \uC81C\uAC70\uD569\uB2C8\uB2E4. (\uBCF5\uAD6C \uBD88\uAC00)');
  spacer(doc);
  warnBox(doc, '\uC0AD\uC81C\uB41C \uD68C\uC6D0\uC740 \uBCF5\uAD6C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC774\uC6A9 \uC815\uC9C0\uAC00 \uD544\uC694\uD55C \uACBD\uC6B0 "\uBE44\uD65C\uC131\uD654"\uB97C \uAD8C\uC7A5\uD569\uB2C8\uB2E4.');

  // ---- Page: Site Management ----
  pageHeader(doc, '3. \uC0AC\uC774\uD2B8 \uAD00\uB9AC');
  para(doc, '\uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC758 "\uC0AC\uC774\uD2B8 \uAD00\uB9AC" \uD0ED\uC5D0\uC11C \uD06C\uB864\uB9C1 \uC0AC\uC774\uD2B8\uC640 \uC0AC\uC6A9\uC790 \uB4F1\uB85D\uC744 \uAD00\uB9AC\uD569\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uB9C8\uC2A4\uD130 \uC0AC\uC774\uD2B8 \uBAA9\uB85D');
  para(doc, '\uC0AC\uC6A9\uC790 \uB4DC\uB86D\uB2E4\uC6B4\uC5D0 \uD45C\uC2DC\uB420 \uD06C\uB864\uB9C1 \uAC00\uB2A5 \uC0AC\uC774\uD2B8 \uBAA9\uB85D\uC744 \uAD00\uB9AC\uD569\uB2C8\uB2E4.');
  bullet(doc, '\uC0AC\uC774\uD2B8 URL, \uC0AC\uC774\uD2B8\uBA85, \uC124\uBA85\uC744 \uC785\uB825\uD558\uC5EC \uCD94\uAC00');
  bullet(doc, '\uD65C\uC131/\uBE44\uD65C\uC131 \uD1A0\uAE00 \uAC00\uB2A5');
  bullet(doc, '\uC0AC\uC774\uD2B8\uBCC4 \uB4F1\uB85D \uC0AC\uC6A9\uC790 \uC218 \uD655\uC778');
  spacer(doc);

  sectionTitle(doc, '\uC0AC\uC6A9\uC790 \uB4F1\uB85D \uC0AC\uC774\uD2B8 \uAD00\uB9AC');
  para(doc, '\uD68C\uC6D0\uB4E4\uC774 \uB4F1\uB85D\uD55C \uC0AC\uC774\uD2B8\uB97C \uD1B5\uD569 \uAD00\uB9AC\uD569\uB2C8\uB2E4.');
  bullet(doc, '\uC0AC\uC6A9\uC790\uBA85/\uC544\uC774\uB514\uB85C \uAC80\uC0C9');
  bullet(doc, '\uC0AC\uC774\uD2B8\uBCC4, \uC0C1\uD0DC\uBCC4 \uD544\uD130\uB9C1');
  bullet(doc, '\uCCB4\uD06C\uBC15\uC2A4\uB85C \uBCF5\uC218 \uC120\uD0DD \uD6C4 \uC77C\uAD04 \uC815\uC9C0/\uC7AC\uAC1C \uAC00\uB2A5');
  spacer(doc);

  sectionTitle(doc, '\uC0C1\uD0DC \uC124\uBA85');
  bullet(doc, '\uB300\uAE30\uC911: \uB4F1\uB85D \uD6C4 \uD655\uC778 \uB300\uAE30');
  bullet(doc, '\uC6B4\uC601\uC911: \uC815\uC0C1 \uD06C\uB864\uB9C1 \uC911');
  bullet(doc, '\uC77C\uC2DC\uC815\uC9C0: \uD06C\uB864\uB9C1 \uC77C\uC2DC \uC911\uB2E8');
  bullet(doc, '\uBC18\uB824: \uAD00\uB9AC\uC790\uAC00 \uAC70\uBD80');

  // ---- Page: Work Request ----
  pageHeader(doc, '4. \uC791\uC5C5 \uC694\uCCAD \uAD00\uB9AC');
  para(doc, '\uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC758 "\uC791\uC5C5\uC694\uCCAD" \uD0ED\uC5D0\uC11C \uC0AC\uC6A9\uC790\uB4E4\uC758 \uC0C8 \uC0AC\uC774\uD2B8 \uCD94\uAC00 \uC694\uCCAD\uC744 \uCC98\uB9AC\uD569\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uC694\uCCAD \uCC98\uB9AC \uD50C\uB85C\uC6B0');
  numberedItem(doc, 1, '\uC0C1\uD0DC\uBCC4 \uD544\uD130\uB85C \uB300\uAE30\uC911\uC778 \uC694\uCCAD\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 2, '\uC694\uCCAD\uC790, \uC0AC\uC774\uD2B8 URL, \uAE30\uD0C0\uC0AC\uD56D\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 3, '\uAD00\uB9AC\uC790 \uBA54\uBAA8\uB97C \uC791\uC131\uD569\uB2C8\uB2E4 (\uC120\uD0DD).');
  numberedItem(doc, 4, '\uC0C1\uD0DC\uB97C \uBCC0\uACBD\uD569\uB2C8\uB2E4:');
  spacer(doc, 2);
  bullet(doc, '\uC2B9\uC778: \uD06C\uB864\uB7EC \uC138\uD305 \uC608\uC815', 80);
  bullet(doc, '\uBC18\uB824: \uC694\uCCAD \uAC70\uBD80', 80);
  bullet(doc, '\uC644\uB8CC: \uD06C\uB864\uB7EC \uC138\uD305 \uC644\uB8CC, \uB9C8\uC2A4\uD130 \uBAA9\uB85D\uC5D0 \uC790\uB3D9 \uCD94\uAC00', 80);
  spacer(doc);
  tipBox(doc, '\uC644\uB8CC \uCC98\uB9AC\uD558\uBA74 \uD574\uB2F9 \uC0AC\uC774\uD2B8\uAC00 \uB9C8\uC2A4\uD130 \uBAA9\uB85D\uC5D0 \uC790\uB3D9\uC73C\uB85C \uCD94\uAC00\uB418\uC5B4 \uC0AC\uC6A9\uC790 \uB4DC\uB86D\uB2E4\uC6B4\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.');

  // ---- Page: Betman Crawling ----
  pageHeader(doc, '5. \uBCA0\uD2B8\uB9E8 \uD06C\uB864\uB9C1');
  para(doc, '\uAD6D\uB0B4 \uBC30\uB2F9 \uD398\uC774\uC9C0 \uC0C1\uB2E8\uC758 "\uBCA0\uD2B8\uB9E8 \uC790\uB3D9 \uD06C\uB864\uB9C1" \uC139\uC158\uC740 \uAD00\uB9AC\uC790\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uC0AC\uC6A9\uBC95');
  numberedItem(doc, 1, '\uAD6D\uB0B4 \uBC30\uB2F9 \uD398\uC774\uC9C0\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 2, '\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uD504\uB85C\uD1A0 \uD68C\uCC28 \uBAA9\uB85D\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 3, '"\uBCA0\uD2B8\uB9E8 \uD06C\uB864\uB9C1 \uC2DC\uC791" \uBC84\uD2BC\uC744 \uD074\uB9AD\uD569\uB2C8\uB2E4.');
  numberedItem(doc, 4, '\uC644\uB8CC \uD6C4 \uC218\uC9D1\uB41C \uACBD\uAE30 \uC218\uC640 \uBC30\uB2F9 \uC218\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.');
  spacer(doc);
  infoBox(doc, '\uCC38\uACE0', '\uBCA0\uD2B8\uB9E8 \uD504\uB85C\uD1A0\uB294 \uB85C\uADF8\uC778 \uC5C6\uC774 \uACF5\uAC1C \uB370\uC774\uD130\uB97C \uC218\uC9D1\uD569\uB2C8\uB2E4. \uBC1C\uB9E4\uC911\uC778 \uD68C\uCC28\uB9CC \uC218\uC9D1 \uAC00\uB2A5\uD569\uB2C8\uB2E4.');

  // ---- Page: Telegram ----
  pageHeader(doc, '6. \uD154\uB808\uADF8\uB7A8 \uC54C\uB9BC \uC2DC\uC2A4\uD15C');
  para(doc, '\uAC01 \uD68C\uC6D0\uC774 \uAC1C\uBCC4\uC801\uC73C\uB85C \uD154\uB808\uADF8\uB7A8 DM\uC73C\uB85C \uC591\uBC29 \uC54C\uB9BC\uC744 \uBC1B\uB294 \uC2DC\uC2A4\uD15C\uC785\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uB3D9\uC791 \uBC29\uC2DD');
  bullet(doc, '\uD68C\uC6D0\uC774 \uC54C\uB9BC \uC124\uC815\uC5D0\uC11C \uD154\uB808\uADF8\uB7A8 \uC5F0\uB3D9\uC744 \uC644\uB8CC\uD558\uBA74 chat_id\uAC00 \uC800\uC7A5\uB429\uB2C8\uB2E4.');
  bullet(doc, '\uC591\uBC29 \uAE30\uD68C \uD0D0\uC9C0 \uC2DC, \uC5F0\uB3D9\uB41C \uBAA8\uB4E0 \uD68C\uC6D0\uC5D0\uAC8C \uB3D9\uC2DC \uBC1C\uC1A1\uB429\uB2C8\uB2E4.');
  bullet(doc, '\uD68C\uC6D0\uC774 \uBD07\uC744 \uCC28\uB2E8\uD558\uBA74 \uC790\uB3D9\uC73C\uB85C \uC5F0\uB3D9\uC774 \uD574\uC81C\uB429\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uAD00\uB9AC\uC790 \uD655\uC778 \uBC29\uBC95');
  bullet(doc, '\uD68C\uC6D0 \uBAA9\uB85D\uC5D0\uC11C \uD3F0 \uC544\uC774\uCF58(\uD3F0)\uC774 \uC788\uC73C\uBA74 \uD154\uB808\uADF8\uB7A8 \uC5F0\uB3D9\uB41C \uD68C\uC6D0\uC785\uB2C8\uB2E4.');
  spacer(doc);

  sectionTitle(doc, '\uD658\uACBD\uBCC0\uC218 \uC124\uC815');
  para(doc, 'Railway \uD658\uACBD\uBCC0\uC218\uC5D0 \uB2E4\uC74C\uC774 \uC124\uC815\uB418\uC5B4 \uC788\uC5B4\uC57C \uD569\uB2C8\uB2E4:');
  spacer(doc, 2);
  bullet(doc, 'TELEGRAM_BOT_TOKEN: \uBD07 \uD1A0\uD070');
  bullet(doc, 'TELEGRAM_CHAT_ID: \uAD00\uB9AC\uC790 \uCC44\uD305 ID (\uAD00\uB9AC\uC790\uB3C4 \uC54C\uB9BC \uC218\uC2E0)');
  bullet(doc, 'TELEGRAM_WEBHOOK_SECRET: \uC6F9\uD6C5 \uBCF4\uC548 \uBE44\uBC00\uD0A4');
  bullet(doc, 'BACKEND_URL: \uBC31\uC5D4\uB4DC \uC8FC\uC18C (https://...)');

  // ---- Page: Checklist ----
  pageHeader(doc, '7. \uC6B4\uC601 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8');
  spacer(doc);

  sectionTitle(doc, '\uC77C\uC77C \uCCB4\uD06C');
  bullet(doc, '\uB300\uC2DC\uBCF4\uB4DC\uC5D0\uC11C \uBC30\uB2F9 \uC218\uC9D1\uC774 \uC815\uC0C1\uC801\uC73C\uB85C \uB3D9\uC791\uD558\uB294\uC9C0 \uD655\uC778');
  bullet(doc, 'API \uD55C\uB3C4 \uC0AC\uC6A9\uB7C9 \uBAA8\uB2C8\uD130\uB9C1');
  bullet(doc, '\uC791\uC5C5 \uC694\uCCAD \uBAA9\uB85D\uC5D0 \uC0C8\uB85C\uC6B4 \uC694\uCCAD\uC774 \uC788\uB294\uC9C0 \uD655\uC778');
  spacer(doc);

  sectionTitle(doc, '\uC8FC\uAC04 \uCCB4\uD06C');
  bullet(doc, '\uD68C\uC6D0 \uBAA9\uB85D\uC5D0\uC11C \uBE44\uD65C\uC131 \uD68C\uC6D0 \uC815\uB9AC');
  bullet(doc, '\uB4F1\uB85D \uC0AC\uC774\uD2B8 \uC0C1\uD0DC \uD655\uC778 (\uD06C\uB864\uB9C1 \uC815\uC0C1 \uC5EC\uBD80)');
  bullet(doc, 'Railway \uBC30\uD3EC \uB85C\uADF8\uC5D0\uC11C \uC5D0\uB7EC \uD655\uC778');
  spacer(doc);

  sectionTitle(doc, '\uC7A5\uC560 \uB300\uC751');
  subTitle(doc, '\uBC30\uB2F9\uC774 \uC218\uC9D1\uB418\uC9C0 \uC54A\uC744 \uB54C');
  bullet(doc, 'Railway Deploy Logs\uC5D0\uC11C \uC5D0\uB7EC \uD655\uC778', 80);
  bullet(doc, 'API \uD55C\uB3C4 \uCD08\uACFC \uC5EC\uBD80 \uD655\uC778', 80);
  bullet(doc, '\uC0AC\uC774\uD2B8 \uD06C\uB864\uB7EC \uB85C\uADF8\uC778 \uC815\uBCF4 \uC720\uD6A8\uC131 \uD655\uC778', 80);
  spacer(doc, 4);

  subTitle(doc, '\uD154\uB808\uADF8\uB7A8 \uC54C\uB9BC\uC774 \uAC00\uC9C0 \uC54A\uC744 \uB54C');
  bullet(doc, 'Railway \uB85C\uADF8\uC5D0\uC11C "\uD154\uB808\uADF8\uB7A8 \uC6F9\uD6C5 \uB4F1\uB85D" \uBA54\uC2DC\uC9C0 \uD655\uC778', 80);
  bullet(doc, '\uD658\uACBD\uBCC0\uC218 TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, BACKEND_URL \uD655\uC778', 80);
  bullet(doc, '\uD68C\uC6D0\uC774 \uBD07\uC744 \uCC28\uB2E8\uD558\uC9C0 \uC54A\uC558\uB294\uC9C0 \uD655\uC778', 80);
  spacer(doc, 4);

  subTitle(doc, 'Railway \uB85C\uADF8 \uD655\uC778 \uBC29\uBC95');
  numberedItem(doc, 1, 'Railway \uB300\uC2DC\uBCF4\uB4DC \uC811\uC18D', 80);
  numberedItem(doc, 2, '\uD504\uB85C\uC81D\uD2B8 \u2192 \uC11C\uBE44\uC2A4 \uC120\uD0DD', 80);
  numberedItem(doc, 3, '"Deployments" \uD0ED \u2192 \uCD5C\uC2E0 \uBC30\uD3EC \uD074\uB9AD', 80);
  numberedItem(doc, 4, '"Deploy Logs"\uC5D0\uC11C \uC5D0\uB7EC \uBA54\uC2DC\uC9C0 \uD655\uC778', 80);

  // Add footers
  addFooters(doc, '\uAD00\uB9AC\uC790 \uAC00\uC774\uB4DC');

  doc.end();
  return new Promise(resolve => stream.on('finish', resolve));
}


// Run both
async function main() {
  console.log('Generating User Guide...');
  await generateUserGuide();
  console.log('User Guide created: SureOdds_User_Guide.pdf');

  console.log('Generating Admin Guide...');
  await generateAdminGuide();
  console.log('Admin Guide created: SureOdds_Admin_Guide.pdf');

  console.log('Done!');
}

main().catch(console.error);
