import {calendarToday,validTimezone,defaultTimezone} from '../../src/domain/calendar.js';
export const installationTimezone=()=>validTimezone(process.env.APP_TIMEZONE||defaultTimezone);
export const installationToday=()=>calendarToday(installationTimezone());
