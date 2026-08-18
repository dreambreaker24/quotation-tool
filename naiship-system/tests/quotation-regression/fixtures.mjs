// 報價系統 Vue 改寫前提②：新舊 PDF 逐項比對用的測試題庫。
// 每筆資料是餵給 quotation-dev.html 的 loadQuote() 用的完整物件，
// 涵蓋幾種容易讓 A4 排版跑掉的情境（單頁/多頁、含稅/未稅、長文字、不同公司品牌）。
// 之後 Vue 版本做出來後，同一批資料用相同流程餵給新版，兩邊截圖逐像素比對。
//
// 唯一資料來源在 src/dev-fixtures/quotationFixtures.js（Vue 元件也 import 同一份），
// 這裡只是 re-export，避免兩份題庫內容分岔導致比對失去意義。
export { fixtures } from '../../src/dev-fixtures/quotationFixtures.js'
