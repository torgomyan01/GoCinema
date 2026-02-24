import axios from "axios";

const instance = axios.create({
  // baseURL: servLink,
  headers: {
    "Content-Type": "application/json",
  },
});

export default instance;
