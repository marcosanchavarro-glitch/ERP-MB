import {createHash} from 'node:crypto';
// Audited pre-Git Windows files differed ONLY in CRLF/LF line endings.
// Accept these exact historical/canonical pairs; never ignore arbitrary checksum changes.
const legacy=new Map([
 ['003_cells.sql',['2eaab45a525c36e7be4654a45fb94e474616a2959000c5cf6d98b4dbbee986f2','24824f2f6dfd08feb2ccbdeba610570f74bb36b9cdc5b80e8834fca0ae395638']],
 ['004_office_workflow.sql',['a9a517a01097d1eaa70ff81f1415324c920e145d99306b2795ac438d92b2c6a3','8f1649c4ecff9193b74f82d96af80cfc3a54b3c38327a2007aefa80146c7efd7']]
]);
export const migrationChecksum=sql=>createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex');
export function matchesMigration(name,stored,checksum){
 const pair=legacy.get(name);
 return stored===checksum||Boolean(pair&&stored===pair[0]&&checksum===pair[1]);
}
