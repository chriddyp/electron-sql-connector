import cronstrue from 'cronstrue';

export function mapHourToCronFormat(hour, amPm) {
    if (hour === 12) {
        if (amPm === 'AM') {
            return 0;
        }
    } else if (amPm === 'PM') {
        return hour + 12;
    }

    return hour;
}

export function mapCronToHourFormat(cronExpression) {
    try {
        cronstrue.toString(cronExpression);
    } catch (_) {
        return null;
    }

    const cronParts = cronExpression.split(' ');
    if (cronParts.length === 6) {
        // disregard seconds component
        cronParts.shift();
    }
    const [cronMinute, cronHour, cronDayOfMonth, cronMonth, cronDaysOfWeek] = cronParts;

    const time = {};
    time.minute = cronMinute.includes('*') ? 0 : Number(cronMinute);
    time.date = cronDayOfMonth.includes('*') ? 1 : Number(cronDayOfMonth);
    time.month = cronMonth.includes('*') ? 1 : Number(cronMonth);
    time.days = cronDaysOfWeek.includes('*') ? ['MON'] : cronDaysOfWeek.split(',');

    if (cronHour.includes('*') && Number(cronHour) > 12) {
        time.hour = Number(cronHour) - 12;
        time.amPm = 'PM';
    } else {
        time.hour = cronHour.includes('*') || Number(cronHour) === 0 ? 12 : Number(cronHour);
        time.amPm = 'AM';
    }

    return time;
}

// https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout#Maximum_delay_value
const MAXIMUM_REFRESH_INTERVAL = 2147483647 / 1000;
export function getInitialCronMode(query) {
    const {cronInterval, refreshInterval} = query;

    if (cronInterval) {
        if (cronInterval === '* * * * *') {
            return 'MINUTE';
        } else if (cronInterval === '*/5 * * * *') {
            return 'FREQUENTLY';
        } else if (cronInterval.match(/\S+? \* \* \* \*/)) {
            return 'HOURLY';
        } else if (cronInterval.match(/\S+? \S+? \* \* \*/)) {
            return 'DAILY';
        } else if (cronInterval.match(/\S+? \S+? \* \* \S+?/)) {
            return 'WEEKLY';
        } else if (cronInterval.match(/\S+? \S+? \S+? \* \*/)) {
            return 'MONTHLY';
        }
    } else if (refreshInterval) {
        // case: refreshInterval is closer to 1 minute than to 5 minutes
        if (refreshInterval <= (60 * (1 + 5)) / 2) {
            return 'MINUTE';
        }
        // case: refreshInterval is closer to 5 minutes than to 1 hour
        else if (refreshInterval <= (60 * (5 + 60)) / 2) {
            return 'FREQUENTLY';
        }
        // case: refreshInterval is closer to 1 hour than to 1 day
        else if (refreshInterval <= (60 * 60 * (1 + 24)) / 2) {
            return 'HOURLY';
        }
        // case: refreshInterval is closer to 1 day than to 1 week
        else if (refreshInterval <= (24 * 60 * 60 * (1 + 7)) / 2) {
            return 'DAILY';
        }
        // case: refreshInterval is closer to 1 week than to 1 month
        else if (refreshInterval <= (24 * 60 * 60 * (7 + 30)) / 2) {
            return 'WEEKLY';
        }
        // Values larger than MAXIMUM_REFRESH_INTERVAL are invalid, and setTimeout treats them as 0
        // We don't want to run the queries so often, so FREQUENTLY is safer default.
        else if (refreshInterval < MAXIMUM_REFRESH_INTERVAL) {
            return 'MONTHLY';
        }
    } else {
        return 'FREQUENTLY';
    }
}
