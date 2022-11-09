const moment = require('moment');

const PRIME_logIn = async (page, userName, password) => {
    console.log(`${userName} is logging in...`);
    await page.goto('https://coworking.prime.cv/web/login', {waitUntil: 'networkidle2', timeout: 0});
    await page.evaluate(({userName, password}) => {
        document.querySelector("#login").value = userName;
        document.querySelector("#password").value = password;
        document.querySelector("#wrapwrap > main > div > form > div.clearfix.oe_login_buttons.text-center.mb-1.pt-3 > button").click();
    }, {userName, password});
    await page.waitForNavigation({waitUntil: 'networkidle0',});
    const currentUrl = await page.url();
    return currentUrl;
}

function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
 }

const PRIME_bookDays = async (page, branchCode, timeStamp, numDays, numMinutes, skipWeekends) => {
    numDays = parseInt(numDays);
    numMinutes = parseInt(numMinutes);
    let startDate = moment(parseInt(timeStamp));
    const endTime = moment(parseInt(timeStamp)).add(numMinutes, 'minutes');
    const timeString = `${startDate.format("HH:mm")} - ${endTime.format("HH:mm")}`;
    if(startDate.format("HH") > endTime.format("HH")){
        return {
            error: true,
            message: "You can't book a time interval that goes between two days."
        }
    }
    const logs = [];
    const slots = [];
    
    while(startDate.format("HH:mm") !== endTime.format("HH:mm")){
        const startHour = startDate.format("HH:mm");
        startDate.add(15, "minutes");
        slots.push(`${startHour} - ${startDate.format("HH:mm")}`);
    }
    for(let i=0; i<numDays; i++){
        startDate.add(i ? 1 : 0, 'days');
        const dateName = startDate.format('YYYY-MM-DD');
        const weekDay = startDate.format('dddd');
        const finalTimeStamp = moment(`${startDate.format("DD/MM/YYYY")} ${timeString}`, "DD/MM/YYYY HH:mm").toDate().getTime();
        if(skipWeekends === 'false' || (skipWeekends && weekDay !== 'Saturday' && weekDay !== 'Sunday')){
            await page.goto('https://coworking.prime.cv/schedule', {waitUntil: 'networkidle2', timeout: 0});
            await page.evaluate(dateName => {
                document.querySelector("#meeting_date").value = dateName;
            }, dateName);
            await page.select("#employee", branchCode.toString());
            await delay(250);
            const availableSlots = await page.evaluate(() => {
                return [].slice.call(document.querySelector("#timeslot").children).map(o=>o.value);
            });
            let isBookable = true;
            slots.forEach(s=>{
                if(!availableSlots.includes(s)){
                    isBookable = false;
                }
            });
            if(isBookable){
                await page.evaluate(({numMinutes, timeString}) => {
                    document.querySelector("#fifteen_minutes").value = numMinutes.toString();
                    document.querySelector("#timeslot > option:nth-child(1)").value = timeString;
                    document.querySelector("#schedule_meeting_form > div > div.form-group.col-12.s_website_form_submit > a.btn.btn-primary.btn-lg.s_website_form_send").click();
                }, {numMinutes, timeString});
                await page.waitForNavigation({waitUntil: 'networkidle0',});
                logs.push({
                    booked: true,
                    date: finalTimeStamp,
                    message: `Booked successfully.`
                });
            }else{
                logs.push({
                    booked: false,
                    date: finalTimeStamp,
                    message: `Not booked: it's already booked.`
                });
            }
            
        }else{
            logs.push({
                booked: false,
                date: finalTimeStamp,
                message: `Not booked: it's a ${weekDay}.`
            });
        }
    }
    return logs;
}

const PRIME_acceptBookings = async (page, numBookings) => {
    console.log(numBookings)
    await page.goto('https://coworking.prime.cv/meetings/my/all_meetings', {waitUntil: 'networkidle2', timeout: 0});
    let acceptedBookings = 0;
    for(let i=0; i<numBookings; i++){
        const accepted = await page.evaluate(() => {
            const a = document.querySelector('a[title=Accept]');
            if(a){
                document.querySelector('a[title=Accept]').click();
                return true;
            }else{
                return false;
            }
        });
        if(accepted){
            console.log(`Booking n°${i+1} accepted.`);
            acceptedBookings++;
            await page.waitForNavigation({waitUntil: 'networkidle0',});
        }else{
            console.log(`There was nothing to accept after request n°${i+1}`);
            return {
                message: `Accepted bookings: ${acceptedBookings}. There was nothing to accept after request n°${i+1}`
            }
        }
    }
    return {
        message: `Accepted bookings: ${acceptedBookings}.`
    }
}

const PRIME_getMeetings = async (page) => {
    await page.goto('https://coworking.prime.cv/meetings/my/all_meetings', {waitUntil: 'networkidle2', timeout: 0});
    const meetings = await page.evaluate(() => {
        const tbody = document.querySelector("#wrap > div > div.table-responsive.border.rounded.border-top-0 > table > tbody");
        const meetings = [];
        [].slice.call(tbody.children).forEach((tr, i) => {
            const tds = tr.children;
            meetings[i] = {};
            meetings[i].branch = tds[0].innerText.replace('01', '').trim();
            meetings[i].date = tds[1].innerText.replace("Today",'').trim();
            meetings[i].time = tds[2].innerText.trim();
            meetings[i].duration = tds[3].innerText.trim();
            meetings[i].state = tds[4].children[0].children[1].innerText.trim();
        });
        return meetings;
    });
    return meetings;
}

module.exports = {PRIME_logIn, PRIME_bookDays, PRIME_acceptBookings, PRIME_getMeetings};