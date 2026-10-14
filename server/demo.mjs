import {blankPerson} from '../src/domain/person.js';
export async function seedDemo(store) {
 if((await store.list()).total) return;
 const examples=[
  {names:'Alba Demo',lastNames:'Ejemplo',document:'DEMO-001',birthDate:'1992-04-18',sex:'MUJER',phone:'+00 000 000 0101',email:'alba@example.invalid',address:'Calle de prueba 101',locality:'Localidad Demo Norte',municipality:'Municipio Demo',province:'Provincia Demo',joinedDate:'2025-03-10'},
  {names:'Bruno Demo',lastNames:'Muestra',sex:'HOMBRE',locality:'Localidad Demo Sur'},
  {names:'Clara Demo',lastNames:'Prueba',document:'DEMO-003',phone:'+00 000 000 0103',sex:'MUJER',status:'INACTIVA',locality:'Localidad Demo Norte'},
  {names:'Darío Demo',lastNames:'Ejemplo',email:'dario@example.invalid'},
  {names:'Elena Demo',lastNames:'Muestra',document:'DEMO-005',birthDate:'1985-08-12',phone:'+00 000 000 0105',email:'elena@example.invalid',address:'Pasaje de prueba 5',locality:'Localidad Demo Sur'},
  {names:'Félix Demo',lastNames:'Prueba',status:'INACTIVA'},
  {names:'Greta Demo',lastNames:'Ejemplo',locality:'Localidad Demo Centro',sex:null},
  {names:'Hugo Demo',lastNames:'Muestra',phone:'+00 000 000 0108'}
 ];
 for(const example of examples) await store.save({...blankPerson(),notes:'Registro ficticio para demostración. No corresponde a una persona real.',...example},{actorId:'system:demo-seed'});
}
