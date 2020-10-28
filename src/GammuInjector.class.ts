import { Database } from 'sqlite'
import { Statement, Database as sql3Database } from 'sqlite3'

export default class GammuInjector {

    // Gammu doesn't support compression
    // @see https://readthedocs.org/projects/gammu/downloads/pdf/latest/
    public compression = 'Default_No_Compression'

    // Identification of program created the message. Can be any string
    public creatorID = 'node-gammu-sql-injector'

    // Gammu table names
    public outboxTable = 'outbox'
    public outboxMultipartTable = 'outbox_multipart'

    protected conn;
    protected phoneNumber = ''
    protected smsClass = 1
    protected priority = 0
    protected message = ''
    protected parts = []

    public constructor(conn: Database<sql3Database, Statement>) {
        this.conn = conn
    }

    // Generates random 2 char HEX string
    protected genReferenceString() {
        return Math.random().toString(16).substring(2, 4).toUpperCase()
    }

    // 7 Bit character part UDH
    // @see https://en.wikipedia.org/wiki/Concatenated_SMS#Sending_a_concatenated_SMS_using_a_User_Data_Header
    protected buildUDH(reference: string, sumParts: number, part: number) {
        let pad = n => n < 10 ? `0${n}` : n
        return `050003${reference}${pad(sumParts)}${pad(part)}`
    }

    // Splits long strings into array of chunks
    // Thx Justin Warkentin @ https://stackoverflow.com/a/29202760
    protected chunkSubstr(str, size) {
        const numChunks = Math.ceil(str.length / size)
        const chunks = new Array(numChunks)

        for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
            chunks[i] = str.substr(o, size)
        }

        return chunks
    }

    protected splitMessage(): Array<string> {

        // If message.length is below 160 send single SMS
        if (this.message.length <= 160) {
            return [this.message]
        }

        // else split message in 153 char chunks (160 chars - udh header length)
        return this.chunkSubstr(this.message, 153)

    }

    public async send(phoneNumber: string, message: string, priority = 0, isFlash = false) {

        this.message = message.trim()
        this.phoneNumber = phoneNumber
        this.priority = priority
        this.smsClass = isFlash ? 0 : 1
        this.parts = this.splitMessage()

        return await this.inject()

    }

    // injects message in our database
    // @see https://wammu.eu/docs/manual/smsd/tables.html
    // @returns insertID of outbox message, -1 if error
    protected async inject() {

        let partsLength = this.parts.length
        let reference = this.genReferenceString()
        let outboxInsertID = 0

        for (let i = 0; i < partsLength; i++) {

            let udh = ''
            if (partsLength > 1) {
                udh = this.buildUDH(reference, partsLength, i + 1)
            }

            let isFirstMessage = i === 0

            let table = isFirstMessage ? this.outboxTable : this.outboxMultipartTable
            let columns = ['UDH', 'TextDecoded', 'Coding', 'Class']
            let binds = [udh, this.parts[i], this.compression, this.smsClass]
            let vals = []

            if (isFirstMessage) {
                columns = [...columns, 'CreatorID', 'MultiPart', 'DestinationNumber', 'Priority', 'InsertIntoDB', 'SendingDateTime']
                binds = [...binds, this.creatorID, (partsLength > 1).toString(), this.phoneNumber, this.priority]
                vals = [...vals, "datetime('now', 'localtime')", "datetime('now', 'localtime')"]
            } else {
                columns = [...columns, 'SequencePosition', 'ID']
                binds = [...binds, i + 1, outboxInsertID]
            }

            let res = await this.conn.run(
                `INSERT INTO 
					${table}
				(
					${columns.join(',')}
				)
				VALUES
				(   
					?${',?'.repeat(binds.length - 1)}
					${vals.length ? ',' + vals.join(',') : ''}
				)`, binds)

            if (!res.lastID) {
                return -1
            }

            if (isFirstMessage) {
                outboxInsertID = res.lastID
            }

        }

        return outboxInsertID

    }

}