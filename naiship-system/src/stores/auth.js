import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const role = ref(null)
  const companyId = ref(null)
  const name = ref(null)

  const isAdmin = computed(() => role.value === 'admin')
  const isManager = computed(() => role.value === 'manager' || role.value === 'admin')

  let resolveReady
  const readyPromise = new Promise(resolve => { resolveReady = resolve })

  function canViewRegion() { return true }

  async function fetchUserProfile(uid, email) {
    try {
      let snap = await getDoc(doc(db, 'users', uid))
      if (!snap.exists() && email) {
        const q = query(collection(db, 'users'), where('email', '==', email))
        const preSnap = await getDocs(q)
        if (!preSnap.empty) {
          const preData = preSnap.docs[0].data()
          role.value = preData.role
          companyId.value = preData.companyId
          name.value = preData.name
          try {
            await setDoc(doc(db, 'users', uid), { ...preData, googleUid: uid })
          } catch (e) {
            console.warn('setDoc users failed:', e)
          }
          return
        }
      }
      if (snap.exists()) {
        const data = snap.data()
        role.value = data.role
        companyId.value = data.companyId
        name.value = data.name
      }
    } catch (e) {
      console.warn('fetchUserProfile failed:', e)
    }
  }

  function init() {
    auth.onAuthStateChanged(async (u) => {
      user.value = u
      if (u) await fetchUserProfile(u.uid, u.email)
      else { role.value = null; companyId.value = null; name.value = null }
      resolveReady()
    })
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  async function logout() {
    await signOut(auth)
  }

  return { user, role, companyId, name, isAdmin, isManager, canViewRegion, readyPromise, init, loginWithGoogle, logout }
})
