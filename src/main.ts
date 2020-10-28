
import * as sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import * as path from 'path'
import GammuInjector from './GammuInjector.class'

(async () => {

    let conn = await open({
        filename: path.join(path.dirname(__dirname), 'example-db.sqlite3'),
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE,
    })

    let gammu = new GammuInjector(conn)

    let phoneNumber = '+15415553010'

    // @see https://messente.com/blog/most-recent/an-easy-way-to-ensure-confidentiality-flash-sms#:~:text=Flash%20SMS%20is%20a%20type,immediately%20catch%20a%20recipient's%20attention.
    let isFlashSMS = false

    // can be any integer. messages with higher priority are processed first
    let priority = 0

    // Make sure to include only supported characters.
    // @see https://support.esendex.co.uk/sms/gsm-alphabet/ 
    let message =
        `Lorem ipsum dolor sit amet, consetetur sadipscing elitr, 
        sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, 
        sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. 

        Stet clita kasd gubergren, no sea tak`

    try {
        let msgID = await gammu.send(phoneNumber, message, priority, isFlashSMS)
        console.log(`Message successfully injected. Outbox-ID: ${msgID}`)
    } catch (e) {
        console.log('Error while injecting message')
        console.log(e)
    }

})()