import ExcelJS from 'exceljs';
import path from 'path';

const FILES = [
    'C:\\Users\\user\\Desktop\\發票開立資訊\\奈拾設計_發票報帳總表.xlsx',
    'C:\\Users\\user\\Desktop\\發票開立資訊\\柏延_發票報帳總表.xlsx',
];

const HEADER_FONT_SIZE = 14;
const DATA_FONT_SIZE   = 13;
const HEADER_ROW_HEIGHT = 40;
const DATA_ROW_HEIGHT   = 32;

async function fixFile(filePath) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    wb.eachSheet(ws => {
        ws.eachRow((row, rowNum) => {
            const isHeader = rowNum === 1;
            row.height = isHeader ? HEADER_ROW_HEIGHT : DATA_ROW_HEIGHT;

            row.eachCell({ includeEmpty: false }, cell => {
                if (!cell.font) cell.font = {};
                cell.font = {
                    ...cell.font,
                    size: isHeader ? HEADER_FONT_SIZE : DATA_FONT_SIZE,
                };
            });
        });
    });

    await wb.xlsx.writeFile(filePath);
    console.log(`完成：${path.basename(filePath)}`);
}

for (const f of FILES) {
    await fixFile(f);
}
console.log('全部更新完畢。');
