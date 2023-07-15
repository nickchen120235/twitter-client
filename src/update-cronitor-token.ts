import { clientCredentials, fetchGuestToken } from './twitter-api';

const API_KEY = process.env['CRONITOR_API_KEY']

// Only keys we need are extracted here
interface Monitor {
    note: keyof typeof clientCredentials;
    request: {
        headers: { [key: string]: string };
    }
}

interface CronitorFailedResponse {
    detail: string;
}

class TokenUpdateError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'TokenUpdateError'
    }
}

async function main() {
    if (API_KEY === undefined) {
        throw new TokenUpdateError('Cronitor API key is not set.')
    }

    const headers = {
        Authorization: `Basic ${Buffer.from(API_KEY+':').toString('base64')}`,
        'Content-Type': 'application/json'
    }
    const monitor: Monitor | CronitorFailedResponse = await fetch('https://cronitor.io/api/monitors/dsoCge', {
        headers
    }).then(res => res.json())
    if ('detail' in monitor) {
        throw new TokenUpdateError(monitor.detail)
    }

    const accessToken = clientCredentials[monitor.note]
    const guest = await fetchGuestToken({ accessToken })
    if (guest.ok && guest.data !== monitor.request.headers['x-guest-token']) {
        console.log(`Updating x-guest-token: ${guest.data}`)
        const data: Partial<Monitor> = {
            request: {
                ...monitor.request,
                headers: {
                    ...monitor.request.headers,
                    'x-guest-token': guest.data
                }
            }
        }
        const res = await fetch('https://cronitor.io/api/monitors/dsoCge', {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        })
        if (res.status !== 200) {
            const { detail } = (await res.json()) as CronitorFailedResponse;
            throw new TokenUpdateError(`Cronitor returned ${res.status} while updating monitor \'${monitor.note}\': ${detail}`)
        }
        else {
            const { request } = (await res.json()) as Monitor
            if (guest.data !== request.headers['x-guest-token']) {
                throw new TokenUpdateError('The updated token does not match the fetched token')
            }
        }
    }
}

(async () => {
    await main()
})()
