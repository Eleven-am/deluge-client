import axios, {AxiosResponse} from "axios";
const validUrl = require('valid-url');

interface Records {
    result: Results;
    error: string | null;
    id: number;
}

interface Results {
    connected: boolean;
    torrents: {
        [key: string]: Torrent
    };
    filters: {
        state: Array<[key: string, value: number]>;
        tracker_host: Array<[key: string, value: number]>;
        owner: Array<[key: string, value: number]>;
    };
    stats: {
        max_download: number,
        max_upload: number,
        max_num_connections: number,
        num_connections: number,
        upload_rate: number,
        download_rate: number,
        download_protocol_rate: number,
        upload_protocol_rate: number,
        dht_nodes: number,
        has_incoming_connections: number,
        free_space: number,
        external_ip: string
    }
}

interface Torrent {
    state: string,
    distributed_copies: number,
    download_payload_rate: number,
    is_auto_managed: boolean,
    max_download_speed: number,
    max_upload_speed: number,
    num_peers: number,
    num_seeds: number,
    progress: number,
    save_path: string,
    seeds_peers_ratio: number,
    time_added: number,
    total_done: number,
    total_peers: number,
    total_seeds: number,
    total_uploaded: number,
    total_wanted: number,
    tracker_host: string,
    upload_payload_rate: number,
    eta: number,
    queue: number,
    ratio: number,
    name: string;

}

export default class DelugeHandler {
    private msgId = 0;
    private loggedIn = false;
    private SESSION_COOKIE = '';
    private readonly PASSWORD: string;
    private readonly DELUGE_URL: string;
    private readonly DOWNLOAD_PATH: string;
    private readonly COOKIE_JAR: { [key: string]: string; } = {};

    /**
     * @param deluge_url the host address of your deluge daemon + /json
     * @param password your deluge password || default is usually deluged
     * @param directory folder where your deluge daemon should download the files to
     * @param cookies { [key: string]: string; } an object holding your personal cookies mapped in a url => cookie fashion
     */
    constructor(deluge_url: string, password: string, directory: string, cookies?: { [key: string]: string; }) {
        if (directory !== '' && deluge_url !== '' && password !== '') {
            this.DELUGE_URL = deluge_url;
            this.PASSWORD = password;
            this.DOWNLOAD_PATH = directory;
            if (cookies)
                this.COOKIE_JAR = cookies;

        } else
            throw new Error('host url and password must be defined');
    }

    /**
     * @desc Get the list of all the hosts that the WebUI can connect to
     */
    async getHosts():Promise<{id: string, ip: string, port: number, status: string}[] | null> {
        let response = await this.secondCalls('web.get_hosts', []);
        if (response && response.result) {
            return response.result.map((element: any[]) => {
                return {id: element[0], ip: element[1], port: element[2], status: element[3]}
            })
        }

        return null;
    }

    /**
     * @desc checks if the daewmon is connected
     */
    async isConnected():Promise<boolean> {
        const response = await this.secondCalls('web.connected', []);
        return response && response.result === true;
    }

    /**
     * @desc Connects the WebUI to the wanted daemon
     * @param hostId the id of the daemon to connect to
     */
    async connect(hostId: string) {
        let response = await this.secondCalls('web.connect', [hostId]);
        if (response) await this.secondCalls('web.connected', [])
        else throw new Error('failed to connect');
    }

    /**
     * @desc adds a torrent magnet or a link to HTTP .torrent file to deluge daemon for download
     * @param magnet
     */
    async add(magnet: string) {
        if (validUrl.isWebUri(magnet)) {
            let cookie = '';
            for (const key in this.COOKIE_JAR) {
                if (this.COOKIE_JAR.hasOwnProperty(key) && magnet.lastIndexOf(key, 0) === 0) {
                    cookie = this.COOKIE_JAR[key];
                    break;
                }
            }

            let response = await this.secondCalls('web.download_torrent_from_url', [magnet, cookie]);
            if (response) {
                const params = this.formParams(response);
                await this.secondCalls('web.add_torrents', params);

            }
        } else {
            const params = this.formParams(magnet);
            await this.secondCalls('web.add_torrents', params);
        }

    }

    /**
     * @desc lists all the torrents being downloaded or finished downloading
     */
    async getRecords(): Promise<Records> {
        let params = [[
            'queue',
            'name',
            'total_wanted',
            'state',
            'progress',
            'num_seeds',
            'total_seeds',
            'num_peers',
            'total_peers',
            'download_payload_rate',
            'upload_payload_rate',
            'eta',
            'ratio',
            'distributed_copies',
            'is_auto_managed',
            'time_added',
            'tracker_host',
            'save_path',
            'total_done',
            'total_uploaded',
            'max_download_speed',
            'max_upload_speed',
            'seeds_peers_ratio'
        ], {}]
        return await this.secondCalls('web.update_ui', params);
    }

    private async authenticate() {
        if (!this.loggedIn) {
            let response = await this.call({
                params: [this.PASSWORD],
                method: 'auth.login'
            })

            if (response && response.headers && response.headers['set-cookie'])
                this.SESSION_COOKIE = response.headers['set-cookie'][0].split(';')[0];

        } else {
            let response = await this.call({
                params: [this.SESSION_COOKIE],
                method: 'auth.check_session'
            })

            this.loggedIn = !!response;
        }
    }

    private async secondCalls(method: string, params: any[]) {
        let response;
        if (!this.loggedIn) {
            await this.authenticate()
            response = await this.call({
                params,
                method
            })

        } else response = await this.call({
            params: [],
            method
        })

        if (response && response.data && response.data.error)
            console.log(response.data.error);

        return response && response.data && response.data.error === null ? response.data : null;
    }

    private async call(body: any): Promise<AxiosResponse | null> {
        return new Promise(resolve => {
            body.id = ++this.msgId;
            if (this.msgId > 1024)
                this.msgId = 0;

            axios.post(this.DELUGE_URL, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': this.SESSION_COOKIE
                }
            }).then(data => {
                resolve(data);
            }).catch(() => resolve(null))
        })
    }

    private formParams(response: string) {
        return [[{
            path: response,
            options: {
                file_priorities: [],
                add_paused: false,
                compact_allocation: true,
                download_location: this.DOWNLOAD_PATH,
                max_connections: -1,
                max_download_speed: -1,
                max_upload_slots: -1,
                max_upload_speed: -1,
                prioritize_first_last_pieces: false
            }
        }]];
    }
}