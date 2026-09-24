// Firestore 特殊型別 ⇄ JSON：匯出正式資料快照、灌進模擬資料庫時共用
import { Timestamp, GeoPoint } from 'firebase-admin/firestore'

export function toJson(value) {
    if (value instanceof Timestamp) return { __ts: [value.seconds, value.nanoseconds] }
    if (value instanceof GeoPoint) return { __geo: [value.latitude, value.longitude] }
    if (value?.constructor?.name === 'DocumentReference') return { __ref: value.path }
    if (Array.isArray(value)) return value.map(toJson)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJson(v)]))
    return value
}

export function fromJson(value, db) {
    if (Array.isArray(value)) return value.map(v => fromJson(v, db))
    if (value && typeof value === 'object') {
        if (value.__ts) return new Timestamp(value.__ts[0], value.__ts[1])
        if (value.__geo) return new GeoPoint(value.__geo[0], value.__geo[1])
        if (value.__ref) return db.doc(value.__ref)
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromJson(v, db)]))
    }
    return value
}
