import axios from 'axios'

export const instance = axios.create({ headers: { 'apikey': process.env.EXCHANGE_RATE_API_KEY } });
