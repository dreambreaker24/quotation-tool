import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const role = ref(null)
  const name = ref(null)
  const authReady = ref(false)

  const isOwner = computed(() => role.value === 'owner')

  let resolveReady
  const readyPromise = new Promise(resolve => { resolveReady = resolve })

  async function fetchUserProfile(uid, email) {
    try {
      let snap = await getDoc(doc(db, 'users', uid))
      if (!snap.exists() && email) {
        const q = query(collection(db, 'users'), where('email', '==', email))
        const preSnap = await getDocs(q)
        if (!preSnap.empty) {
          const preData = preSnap.docs[0].data()
          role.value = preData.role
          name.value = preData.name
          try {
            await setDoc(doc(db, 'users', uid), { ...preData, googleUid: uid })
            await deleteDoc(preSnap.docs[0].ref)
          } catch (e) {
            console.warn('setDoc users failed:', e)
          }
          return
        }
      }
      if (snap.exists()) {
        const data = snap.data()
        role.value = data.role
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
      else { role.value = null; name.value = null }
      authReady.value = true
      resolveReady()
    })
    getRedirectResult(auth).catch(() => {})
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch {
      await signInWithRedirect(auth, provider)
    }
  }

  async function logout() {
    await signOut(auth)
  }

  return { user, role, name, authReady, isOwner, readyPromise, init, loginWithGoogle, logout }
})
