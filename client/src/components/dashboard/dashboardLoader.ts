import { store } from "@/app/store"
import { apiSlice as api } from "@/features/api/apiSlice";

export async function loader() {
    const payload = await store.dispatch(api.endpoints.authUser.initiate({authOnly: true})).unwrap()
    // check auth
}
