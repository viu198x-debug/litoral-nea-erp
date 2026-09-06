import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RecordStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateRecordDto } from "./dto/create-record.dto";
import type { UpdateRecordDto } from "./dto/update-record.dto";

const modules = new Set(["budgets","progress","certificates","dossiers","hr","payroll","per-diems","lodging","concrete"]);

@Injectable()
export class ConstructionCoreRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  handles(module: string) { return modules.has(module); }

  async list(companyId: string, module: string, filters: { workId?: string; status?: RecordStatus; search?: string }) {
    const search = filters.search?.trim().slice(0,120);
    switch(module){
      case "budgets": {
        const rows=await this.prisma.budget.findMany({
          where:{deletedAt:null,...(filters.workId?{workId:filters.workId}:{}),work:{companyId},...(search?{OR:[{type:{contains:search,mode:"insensitive"}},{items:{some:{description:{contains:search,mode:"insensitive"}}}}]}:{})},
          include:{work:{select:{code:true,name:true}},items:{orderBy:{sortOrder:"asc"}}},
          orderBy:{updatedAt:"desc"},take:100
        });
        return rows.map(x=>this.row(x.id,`PRE-${x.work.code}-V${x.version}`,`${x.type} · V${x.version}`,x.status,x.total,x.updatedAt,x.createdById,x.work,{
          budgetType:x.type,version:x.version,category:x.items[0]?.parentId??"",item:x.items[0]?.description??"",unit:x.items[0]?.unit??"",
          quantity:x.items[0]?.quantity??0,materialCost:x.items[0]?.materialCost??0,laborCost:x.items[0]?.laborCost??0,equipmentCost:x.items[0]?.equipmentCost??0,
          subcontractCost:x.items[0]?.subcontractCost??0,utilityPct:x.utilityPct,vatPct:x.vatPct,total:x.total
        }));
      }
      case "progress": {
        const rows=await this.prisma.dailyReport.findMany({
          where:{deletedAt:null,...(filters.workId?{workId:filters.workId}:{}),work:{companyId},...(search?{OR:[{observations:{contains:search,mode:"insensitive"}},{weather:{contains:search,mode:"insensitive"}}]}:{})},
          include:{work:{select:{code:true,name:true}}},orderBy:{reportDate:"desc"},take:100
        });
        return rows.map(x=>{const m=x.metadata as Record<string,unknown>;return this.row(x.id,`PAR-${x.work.code}-${x.reportDate.toISOString().slice(0,10)}`,String(m.activity??"Parte diario"),RecordStatus.ACTIVE,m.economicProgress??0,x.reportDate,x.createdById,x.work,{
          reportDate:x.reportDate,physicalProgress:x.physicalProgress,economicProgress:m.economicProgress??0,weather:x.weather,
          personnelCount:x.personnelCount,equipmentCount:x.equipmentCount,materials:x.materials,observations:x.observations,activity:m.activity??"",resources:m.resources??""
        })});
      }
      case "certificates": {
        const rows=await this.prisma.certificate.findMany({
          where:{deletedAt:null,...(filters.workId?{workId:filters.workId}:{}),work:{companyId},...(search?{OR:[{invoiceNumber:{contains:search,mode:"insensitive"}},{paymentOrder:{contains:search,mode:"insensitive"}}]}:{})},
          include:{work:{select:{code:true,name:true}}},orderBy:{periodTo:"desc"},take:100
        });
        return rows.map(x=>{const m=x.metadata as Record<string,unknown>;return this.row(x.id,`CER-${x.work.code}-${x.number}`,`Certificado N° ${x.number}`,x.status,x.netAmount,x.periodTo,"certificates",x.work,{
          number:x.number,periodFrom:x.periodFrom,periodTo:x.periodTo,progressPct:x.progressPct,grossAmount:x.grossAmount,advanceDeduction:x.advanceDeduction,
          repairFund:x.repairFund,withholdings:x.withholdings,netAmount:x.netAmount,invoiceNumber:x.invoiceNumber,dossierNumber:m.dossierNumber??"",paymentOrder:x.paymentOrder,collectedAmount:x.collectedAmount
        })});
      }
      case "dossiers": {
        const rows=await this.prisma.dossier.findMany({
          where:{deletedAt:null,...(filters.workId?{workId:filters.workId}:{}),AND:[{OR:[{workId:null},{work:{companyId}}]},...(search?[{OR:[{number:{contains:search,mode:"insensitive" as const}},{concept:{contains:search,mode:"insensitive" as const}},{organization:{contains:search,mode:"insensitive" as const}}]}]:[])]},
          include:{work:{select:{code:true,name:true}},movements:{orderBy:{movedAt:"desc"},take:1}},orderBy:{updatedAt:"desc"},take:100
        });
        return rows.map(x=>{const m=x.metadata as Record<string,unknown>;return this.row(x.id,x.number,x.concept,x.status,x.amount,x.lastMovementAt??x.openedAt,x.responsibleId??"dossiers",x.work,{
          organization:x.organization,number:x.number,openedAt:x.openedAt,responsible:m.responsible??"",lastMovement:x.movements[0]?.description??"",lastMovementAt:x.lastMovementAt,
          amount:x.amount,paidAmount:x.paidAmount,balance:Number(x.amount)-Number(x.paidAmount),alertDays:m.alertDays??0,paymentStatus:m.paymentStatus??"Pendiente"
        })});
      }
      case "hr": {
        const rows=await this.prisma.employee.findMany({where:{...(search?{OR:[{employeeNumber:{contains:search,mode:"insensitive"}},{firstName:{contains:search,mode:"insensitive"}},{lastName:{contains:search,mode:"insensitive"}}]}:{})},orderBy:[{active:"desc"},{lastName:"asc"}],take:100});
        return rows.map(x=>{const m=x.metadata as Record<string,unknown>;return this.row(x.id,x.employeeNumber,`${x.firstName} ${x.lastName}`,x.active?RecordStatus.ACTIVE:RecordStatus.VOID,x.baseSalary,x.hireDate,"hr",null,{
          employeeNumber:x.employeeNumber,taxId:x.taxId,category:x.category,position:x.position,hireDate:x.hireDate,attendance:m.attendance??"",hours:m.hours??0,overtime:m.overtime??0,
          baseSalary:x.baseSalary,documentationDue:m.documentationDue??null,active:x.active?"Sí":"No"
        })});
      }
      case "payroll": {
        const rows=await this.prisma.payroll.findMany({where:{...(filters.workId?{workId:filters.workId}:{}),AND:[{OR:[{workId:null},{work:{companyId}}]},...(search?[{employee:{OR:[{employeeNumber:{contains:search,mode:"insensitive" as const}},{firstName:{contains:search,mode:"insensitive" as const}},{lastName:{contains:search,mode:"insensitive" as const}}]}}]:[])]},include:{employee:true,work:{select:{code:true,name:true}}},orderBy:{period:"desc"},take:100});
        return rows.map(x=>{const m=x.metadata as Record<string,unknown>;return this.row(x.id,`SUE-${x.employee.employeeNumber}-${x.period}`,`${x.employee.firstName} ${x.employee.lastName} · ${x.period}`,x.status,x.companyCost,new Date(`${x.period}-01T00:00:00Z`),"payroll",x.work,{
          employee:`${x.employee.employeeNumber} · ${x.employee.firstName} ${x.employee.lastName}`,period:x.period,baseAmount:x.baseAmount,additions:x.additions,overtime:x.overtime,perDiems:x.perDiemsAmount,
          advances:x.advances,deductions:x.deductions,employerContributions:x.employerContributions,companyCost:x.companyCost,allocationPct:m.allocationPct??100
        })});
      }
      case "per-diems": {
        const rows=await this.prisma.perDiem.findMany({where:{...(filters.workId?{workId:filters.workId}:{}),AND:[{OR:[{workId:null},{work:{companyId}}]},...(search?[{OR:[{destination:{contains:search,mode:"insensitive" as const}},{employee:{firstName:{contains:search,mode:"insensitive" as const}}},{employee:{lastName:{contains:search,mode:"insensitive" as const}}}]}]:[])]},include:{employee:true,work:{select:{code:true,name:true}}},orderBy:{startDate:"desc"},take:100});
        return rows.map(x=>{const m=x.metadata as Record<string,unknown>;return this.row(x.id,`VIA-${x.id.slice(-8).toUpperCase()}`,`${x.employee.firstName} ${x.employee.lastName} · ${x.destination}`,x.status,x.advance,x.startDate,"per-diems",x.work,{
          employee:`${x.employee.employeeNumber} · ${x.employee.firstName} ${x.employee.lastName}`,destination:x.destination,startDate:x.startDate,endDate:x.endDate,reason:m.reason??"",advance:x.advance,
          expenses:x.expenses,receipts:m.receipts??"",balance:x.balance,authorization:m.authorization??x.status
        })});
      }
      case "lodging": {
        const rows=await this.prisma.lodging.findMany({where:{...(filters.workId?{workId:filters.workId}:{}),AND:[{OR:[{workId:null},{work:{companyId}}]},...(search?[{hotel:{contains:search,mode:"insensitive" as const}}]:[])]},include:{work:{select:{code:true,name:true}}},orderBy:{checkIn:"desc"},take:100});
        return rows.map(x=>{const m=x.metadata as Record<string,unknown>;return this.row(x.id,`ALO-${x.id.slice(-8).toUpperCase()}`,x.hotel,x.status,x.total,x.checkIn,"lodging",x.work,{
          hotel:x.hotel,people:m.people??"",peopleCount:x.peopleCount,checkIn:x.checkIn,checkOut:x.checkOut,nights:x.nights,nightlyRate:x.nightlyRate,total:x.total,invoice:x.invoice,paymentStatus:m.paymentStatus??"Pendiente"
        })});
      }
      case "concrete": {
        const rows=await this.prisma.concreteOrder.findMany({where:{...(filters.workId?{workId:filters.workId}:{}),work:{companyId},...(search?{OR:[{number:{contains:search,mode:"insensitive"}},{dosage:{contains:search,mode:"insensitive"}}]}:{})},include:{work:{select:{code:true,name:true}}},orderBy:{productionDate:"desc"},take:100});
        return rows.map(x=>{const m=x.metadata as Record<string,unknown>;return this.row(x.id,x.number,`${x.dosage} · ${Number(x.cubicMeters)} m³`,x.status,Number(x.cubicMeters)*Number(x.costPerM3),x.productionDate,"concrete",x.work,{
          productionDate:x.productionDate,dosage:x.dosage,cubicMeters:x.cubicMeters,cementKg:x.cementKg,sandM3:x.sandM3,stoneM3:x.stoneM3,additives:m.additives??x.additives,
          truck:x.truck,driver:x.driver,deliveryNote:x.deliveryNote,costPerM3:x.costPerM3,totalCost:Number(x.cubicMeters)*Number(x.costPerM3)
        })});
      }
    }
  }

  async create(companyId:string,module:string,userId:string,dto:CreateRecordDto){
    const d=dto.data??{}; if(dto.workId) await this.requireWork(companyId,dto.workId);
    switch(module){
      case "budgets": {
        if(!dto.workId) throw new BadRequestException("El presupuesto debe pertenecer a una obra");
        const type=String(d.budgetType??"Objetivo"),version=this.int(d.version||1),qty=this.num(d.quantity),total=this.num(d.total),utility=this.num(d.utilityPct),vat=this.num(d.vatPct||21);
        const base=total/(1+(vat/100)); const budget=await this.prisma.budget.create({data:{workId:dto.workId,type,version,status:dto.status??RecordStatus.DRAFT,subtotal:base,utilityPct:utility,vatPct:vat,total,createdById:userId,approvedById:dto.status===RecordStatus.APPROVED?userId:undefined,approvedAt:dto.status===RecordStatus.APPROVED?new Date():undefined,
          items:{create:{code:dto.code,description:String(d.item??dto.title),unit:String(d.unit??"u"),quantity:qty,materialCost:this.num(d.materialCost),laborCost:this.num(d.laborCost),equipmentCost:this.num(d.equipmentCost),subcontractCost:this.num(d.subcontractCost),unitPrice:qty?total/qty:total,total,sortOrder:0}}}});
        await this.prisma.work.update({where:{id:dto.workId},data:{targetBudget:total}});
        return {id:budget.id,code:dto.code,title:dto.title};
      }
      case "progress": {
        if(!dto.workId) throw new BadRequestException("El parte debe pertenecer a una obra");
        const reportDate=this.date(d.reportDate??dto.occurredAt)??new Date(); const physical=this.num(d.physicalProgress);
        const row=await this.prisma.dailyReport.upsert({where:{workId_reportDate:{workId:dto.workId,reportDate}},update:{weather:this.str(d.weather),physicalProgress:physical,personnelCount:this.int(d.personnelCount),equipmentCount:this.int(d.equipmentCount),materials:this.json(d.materials),observations:this.str(d.observations),metadata:{activity:dto.title,economicProgress:this.num(d.economicProgress),resources:d.resources??null} as Prisma.InputJsonValue,deletedAt:null},create:{workId:dto.workId,reportDate,weather:this.str(d.weather),physicalProgress:physical,personnelCount:this.int(d.personnelCount),equipmentCount:this.int(d.equipmentCount),materials:this.json(d.materials),observations:this.str(d.observations),metadata:{activity:dto.title,economicProgress:this.num(d.economicProgress),resources:d.resources??null} as Prisma.InputJsonValue,createdById:userId}});
        await this.prisma.work.update({where:{id:dto.workId},data:{physicalProgress:physical,financialProgress:this.num(d.economicProgress)}});
        return {id:row.id,code:dto.code,title:dto.title};
      }
      case "certificates": {
        if(!dto.workId) throw new BadRequestException("El certificado debe pertenecer a una obra");
        const row=await this.prisma.certificate.create({data:{workId:dto.workId,number:this.int(d.number),periodFrom:this.reqDate(d.periodFrom,"Período desde"),periodTo:this.reqDate(d.periodTo,"Período hasta"),progressPct:this.num(d.progressPct),grossAmount:this.num(d.grossAmount),advanceDeduction:this.num(d.advanceDeduction),repairFund:this.num(d.repairFund),withholdings:this.num(d.withholdings),netAmount:this.num(d.netAmount),invoiceNumber:this.str(d.invoiceNumber),paymentOrder:this.str(d.paymentOrder),collectedAmount:this.num(d.collectedAmount),status:dto.status??RecordStatus.PENDING,metadata:{dossierNumber:d.dossierNumber??null} as Prisma.InputJsonValue}});
        await this.refreshWorkFinancial(dto.workId);
        return {id:row.id,code:dto.code,title:dto.title};
      }
      case "dossiers": {
        const row=await this.prisma.dossier.create({data:{workId:dto.workId,organization:String(d.organization??""),number:String(d.number??dto.code),concept:dto.title,openedAt:this.reqDate(d.openedAt,"Fecha de alta"),status:dto.status??RecordStatus.PENDING,responsibleId:userId,amount:this.num(d.amount),paidAmount:this.num(d.paidAmount),lastMovementAt:this.date(d.lastMovementAt),metadata:{responsible:d.responsible??null,alertDays:this.num(d.alertDays),paymentStatus:d.paymentStatus??"Pendiente"} as Prisma.InputJsonValue,movements:d.lastMovement?{create:{movedAt:this.date(d.lastMovementAt)??new Date(),description:String(d.lastMovement),userId}}:undefined}});
        return {id:row.id,code:row.number,title:row.concept};
      }
      case "hr": {
        const names=dto.title.trim().split(/\s+/); const firstName=names.shift()??dto.title,lastName=names.join(" ")||"-";
        const row=await this.prisma.employee.create({data:{employeeNumber:String(d.employeeNumber??dto.code),taxId:String(d.taxId??""),firstName,lastName,category:String(d.category??""),position:String(d.position??""),hireDate:this.reqDate(d.hireDate,"Fecha de ingreso"),baseSalary:this.num(d.baseSalary),active:this.bool(d.active,true),metadata:{attendance:d.attendance??null,hours:this.num(d.hours),overtime:this.num(d.overtime),documentationDue:d.documentationDue??null} as Prisma.InputJsonValue}});
        return {id:row.id,code:row.employeeNumber,title:dto.title};
      }
      case "payroll": {
        const employeeId=await this.employeeId(d.employee); const row=await this.prisma.payroll.create({data:{employeeId,workId:dto.workId,period:String(d.period??""),baseAmount:this.num(d.baseAmount),additions:this.num(d.additions),overtime:this.num(d.overtime),perDiemsAmount:this.num(d.perDiems),advances:this.num(d.advances),deductions:this.num(d.deductions),employerContributions:this.num(d.employerContributions),companyCost:this.num(d.companyCost),status:dto.status??RecordStatus.DRAFT,metadata:{allocationPct:this.num(d.allocationPct)} as Prisma.InputJsonValue}});
        if(dto.workId) await this.addWorkCost(dto.workId,this.num(d.companyCost));
        return {id:row.id,code:dto.code,title:dto.title};
      }
      case "per-diems": {
        const employeeId=await this.employeeId(d.employee); const advance=this.num(d.advance),expenses=this.num(d.expenses),balance=d.balance===undefined?advance-expenses:this.num(d.balance);
        const row=await this.prisma.perDiem.create({data:{employeeId,workId:dto.workId,destination:String(d.destination??""),startDate:this.reqDate(d.startDate,"Desde"),endDate:this.reqDate(d.endDate,"Hasta"),advance,expenses,balance,status:dto.status??RecordStatus.PENDING,metadata:{reason:d.reason??null,receipts:d.receipts??null,authorization:d.authorization??null} as Prisma.InputJsonValue}});
        if(dto.workId) await this.addWorkCost(dto.workId,expenses);
        return {id:row.id,code:dto.code,title:dto.title};
      }
      case "lodging": {
        if(!dto.workId) throw new BadRequestException("El alojamiento debe imputarse a una obra");
        const row=await this.prisma.lodging.create({data:{workId:dto.workId,hotel:String(d.hotel??dto.title),peopleCount:this.int(d.peopleCount),checkIn:this.reqDate(d.checkIn,"Ingreso"),checkOut:this.reqDate(d.checkOut,"Salida"),nights:this.int(d.nights),nightlyRate:this.num(d.nightlyRate),total:this.num(d.total),invoice:this.str(d.invoice),status:dto.status??RecordStatus.PENDING,metadata:{people:d.people??null,paymentStatus:d.paymentStatus??"Pendiente"} as Prisma.InputJsonValue}});
        await this.addWorkCost(dto.workId,this.num(d.total));
        return {id:row.id,code:dto.code,title:row.hotel};
      }
      case "concrete": {
        if(!dto.workId) throw new BadRequestException("La orden de hormigón debe pertenecer a una obra");
        const row=await this.prisma.concreteOrder.create({data:{number:dto.code,workId:dto.workId,productionDate:this.reqDate(d.productionDate,"Fecha de producción"),dosage:String(d.dosage??""),cubicMeters:this.num(d.cubicMeters),cementKg:this.num(d.cementKg),sandM3:this.num(d.sandM3),stoneM3:this.num(d.stoneM3),additives:this.json(d.additives),truck:this.str(d.truck),driver:this.str(d.driver),deliveryNote:this.str(d.deliveryNote),costPerM3:this.num(d.costPerM3),status:dto.status??RecordStatus.PENDING,metadata:{additives:d.additives??null} as Prisma.InputJsonValue}});
        await this.addWorkCost(dto.workId,this.num(d.totalCost)||this.num(d.cubicMeters)*this.num(d.costPerM3));
        return {id:row.id,code:row.number,title:dto.title};
      }
    }
  }

  async update(companyId:string,module:string,id:string,dto:UpdateRecordDto){
    const d=dto.data??{}; if(dto.workId) await this.requireWork(companyId,dto.workId);
    switch(module){
      case "progress": {
        const row=await this.prisma.dailyReport.findFirst({where:{id,deletedAt:null,work:{companyId}}}); if(!row) throw new NotFoundException("Parte no encontrado");
        const updated=await this.prisma.dailyReport.update({where:{id},data:{reportDate:d.reportDate===undefined?undefined:this.date(d.reportDate),weather:d.weather===undefined?undefined:this.str(d.weather),physicalProgress:d.physicalProgress===undefined?undefined:this.num(d.physicalProgress),personnelCount:d.personnelCount===undefined?undefined:this.int(d.personnelCount),equipmentCount:d.equipmentCount===undefined?undefined:this.int(d.equipmentCount),materials:d.materials===undefined?undefined:this.json(d.materials),observations:d.observations===undefined?undefined:this.str(d.observations),metadata:Object.keys(d).length?{activity:dto.title??null,economicProgress:this.num(d.economicProgress),resources:d.resources??null} as Prisma.InputJsonValue:undefined}});
        await this.prisma.work.update({where:{id:updated.workId},data:{physicalProgress:Number(updated.physicalProgress),financialProgress:this.num(d.economicProgress)}});
        return updated;
      }
      case "certificates": {
        const row=await this.prisma.certificate.findFirst({where:{id,deletedAt:null,work:{companyId}}}); if(!row) throw new NotFoundException("Certificado no encontrado");
        const updated=await this.prisma.certificate.update({where:{id},data:{number:d.number===undefined?undefined:this.int(d.number),periodFrom:d.periodFrom===undefined?undefined:this.date(d.periodFrom),periodTo:d.periodTo===undefined?undefined:this.date(d.periodTo),progressPct:d.progressPct===undefined?undefined:this.num(d.progressPct),grossAmount:d.grossAmount===undefined?undefined:this.num(d.grossAmount),advanceDeduction:d.advanceDeduction===undefined?undefined:this.num(d.advanceDeduction),repairFund:d.repairFund===undefined?undefined:this.num(d.repairFund),withholdings:d.withholdings===undefined?undefined:this.num(d.withholdings),netAmount:d.netAmount===undefined?undefined:this.num(d.netAmount),invoiceNumber:d.invoiceNumber===undefined?undefined:this.str(d.invoiceNumber),paymentOrder:d.paymentOrder===undefined?undefined:this.str(d.paymentOrder),collectedAmount:d.collectedAmount===undefined?undefined:this.num(d.collectedAmount),status:dto.status,metadata:d.dossierNumber===undefined?undefined:{dossierNumber:d.dossierNumber} as Prisma.InputJsonValue}});
        await this.refreshWorkFinancial(updated.workId); return updated;
      }
      case "dossiers": {
        const row=await this.prisma.dossier.findFirst({where:{id,deletedAt:null,AND:[{OR:[{workId:null},{work:{companyId}}]}]}}); if(!row) throw new NotFoundException("Expediente no encontrado");
        return this.prisma.dossier.update({where:{id},data:{workId:dto.workId,organization:d.organization===undefined?undefined:String(d.organization),number:d.number===undefined?undefined:String(d.number),concept:dto.title,openedAt:d.openedAt===undefined?undefined:this.date(d.openedAt),status:dto.status,amount:d.amount===undefined?undefined:this.num(d.amount),paidAmount:d.paidAmount===undefined?undefined:this.num(d.paidAmount),lastMovementAt:d.lastMovementAt===undefined?undefined:this.date(d.lastMovementAt),metadata:Object.keys(d).length?{responsible:d.responsible??null,alertDays:this.num(d.alertDays),paymentStatus:d.paymentStatus??"Pendiente"} as Prisma.InputJsonValue:undefined,movements:d.lastMovement?{create:{movedAt:this.date(d.lastMovementAt)??new Date(),description:String(d.lastMovement),userId:row.responsibleId??"system"}}:undefined}});
      }
      case "hr": {
        const row=await this.prisma.employee.findUnique({where:{id}}); if(!row) throw new NotFoundException("Empleado no encontrado");
        const names=dto.title?.trim().split(/\s+/); return this.prisma.employee.update({where:{id},data:{firstName:names?.shift(),lastName:names?.join(" "),employeeNumber:d.employeeNumber===undefined?undefined:String(d.employeeNumber),taxId:d.taxId===undefined?undefined:String(d.taxId),category:d.category===undefined?undefined:String(d.category),position:d.position===undefined?undefined:String(d.position),hireDate:d.hireDate===undefined?undefined:this.date(d.hireDate),baseSalary:d.baseSalary===undefined?undefined:this.num(d.baseSalary),active:d.active===undefined?undefined:this.bool(d.active,true),metadata:Object.keys(d).length?{attendance:d.attendance??null,hours:this.num(d.hours),overtime:this.num(d.overtime),documentationDue:d.documentationDue??null} as Prisma.InputJsonValue:undefined}});
      }
      case "payroll": {
        const row=await this.prisma.payroll.findUnique({where:{id}}); if(!row) throw new NotFoundException("Liquidación no encontrada");
        return this.prisma.payroll.update({where:{id},data:{workId:dto.workId,period:d.period===undefined?undefined:String(d.period),baseAmount:d.baseAmount===undefined?undefined:this.num(d.baseAmount),additions:d.additions===undefined?undefined:this.num(d.additions),overtime:d.overtime===undefined?undefined:this.num(d.overtime),perDiemsAmount:d.perDiems===undefined?undefined:this.num(d.perDiems),advances:d.advances===undefined?undefined:this.num(d.advances),deductions:d.deductions===undefined?undefined:this.num(d.deductions),employerContributions:d.employerContributions===undefined?undefined:this.num(d.employerContributions),companyCost:d.companyCost===undefined?undefined:this.num(d.companyCost),status:dto.status,metadata:d.allocationPct===undefined?undefined:{allocationPct:this.num(d.allocationPct)} as Prisma.InputJsonValue}});
      }
      case "per-diems": return this.prisma.perDiem.update({where:{id},data:{workId:dto.workId,destination:d.destination===undefined?undefined:String(d.destination),startDate:d.startDate===undefined?undefined:this.date(d.startDate),endDate:d.endDate===undefined?undefined:this.date(d.endDate),advance:d.advance===undefined?undefined:this.num(d.advance),expenses:d.expenses===undefined?undefined:this.num(d.expenses),balance:d.balance===undefined?undefined:this.num(d.balance),status:dto.status,metadata:Object.keys(d).length?{reason:d.reason??null,receipts:d.receipts??null,authorization:d.authorization??null} as Prisma.InputJsonValue:undefined}});
      case "lodging": return this.prisma.lodging.update({where:{id},data:{workId:dto.workId,hotel:d.hotel===undefined?dto.title:String(d.hotel),peopleCount:d.peopleCount===undefined?undefined:this.int(d.peopleCount),checkIn:d.checkIn===undefined?undefined:this.date(d.checkIn),checkOut:d.checkOut===undefined?undefined:this.date(d.checkOut),nights:d.nights===undefined?undefined:this.int(d.nights),nightlyRate:d.nightlyRate===undefined?undefined:this.num(d.nightlyRate),total:d.total===undefined?undefined:this.num(d.total),invoice:d.invoice===undefined?undefined:this.str(d.invoice),status:dto.status,metadata:Object.keys(d).length?{people:d.people??null,paymentStatus:d.paymentStatus??"Pendiente"} as Prisma.InputJsonValue:undefined}});
      case "concrete": return this.prisma.concreteOrder.update({where:{id},data:{productionDate:d.productionDate===undefined?undefined:this.date(d.productionDate),dosage:d.dosage===undefined?undefined:String(d.dosage),cubicMeters:d.cubicMeters===undefined?undefined:this.num(d.cubicMeters),cementKg:d.cementKg===undefined?undefined:this.num(d.cementKg),sandM3:d.sandM3===undefined?undefined:this.num(d.sandM3),stoneM3:d.stoneM3===undefined?undefined:this.num(d.stoneM3),additives:d.additives===undefined?undefined:this.json(d.additives),truck:d.truck===undefined?undefined:this.str(d.truck),driver:d.driver===undefined?undefined:this.str(d.driver),deliveryNote:d.deliveryNote===undefined?undefined:this.str(d.deliveryNote),costPerM3:d.costPerM3===undefined?undefined:this.num(d.costPerM3),status:dto.status,metadata:d.additives===undefined?undefined:{additives:d.additives} as Prisma.InputJsonValue}});
      case "budgets": {
        const row=await this.prisma.budget.findFirst({where:{id,deletedAt:null,work:{companyId}},include:{items:{orderBy:{sortOrder:"asc"},take:1}}}); if(!row) throw new NotFoundException("Presupuesto no encontrado");
        const total=d.total===undefined?Number(row.total):this.num(d.total),vat=d.vatPct===undefined?Number(row.vatPct):this.num(d.vatPct); const updated=await this.prisma.budget.update({where:{id},data:{type:d.budgetType===undefined?undefined:String(d.budgetType),version:d.version===undefined?undefined:this.int(d.version),status:dto.status,total,subtotal:total/(1+vat/100),utilityPct:d.utilityPct===undefined?undefined:this.num(d.utilityPct),vatPct:vat,approvedById:dto.status===RecordStatus.APPROVED?row.createdById:undefined,approvedAt:dto.status===RecordStatus.APPROVED?new Date():undefined}});
        if(row.items[0]) await this.prisma.budgetItem.update({where:{id:row.items[0].id},data:{description:d.item===undefined?undefined:String(d.item),unit:d.unit===undefined?undefined:String(d.unit),quantity:d.quantity===undefined?undefined:this.num(d.quantity),materialCost:d.materialCost===undefined?undefined:this.num(d.materialCost),laborCost:d.laborCost===undefined?undefined:this.num(d.laborCost),equipmentCost:d.equipmentCost===undefined?undefined:this.num(d.equipmentCost),subcontractCost:d.subcontractCost===undefined?undefined:this.num(d.subcontractCost),total,unitPrice:d.quantity===undefined?undefined:(this.num(d.quantity)?total/this.num(d.quantity):total)}});
        await this.prisma.work.update({where:{id:updated.workId},data:{targetBudget:total}}); return updated;
      }
    }
  }

  async softDelete(companyId:string,module:string,id:string,userId:string){
    switch(module){
      case "budgets": return this.prisma.budget.update({where:{id},data:{deletedAt:new Date(),status:RecordStatus.VOID}});
      case "progress": return this.prisma.dailyReport.update({where:{id},data:{deletedAt:new Date()}});
      case "certificates": {const r=await this.prisma.certificate.update({where:{id},data:{deletedAt:new Date(),status:RecordStatus.VOID}});await this.refreshWorkFinancial(r.workId);return r;}
      case "dossiers": return this.prisma.dossier.update({where:{id},data:{deletedAt:new Date(),status:RecordStatus.VOID}});
      case "hr": return this.prisma.employee.update({where:{id},data:{active:false}});
      case "payroll": return this.prisma.payroll.update({where:{id},data:{status:RecordStatus.VOID}});
      case "per-diems": return this.prisma.perDiem.update({where:{id},data:{status:RecordStatus.VOID}});
      case "lodging": return this.prisma.lodging.update({where:{id},data:{status:RecordStatus.VOID}});
      case "concrete": return this.prisma.concreteOrder.update({where:{id},data:{status:RecordStatus.VOID}});
    }
  }

  private async refreshWorkFinancial(workId:string){
    const [work,certs]=await Promise.all([this.prisma.work.findUnique({where:{id:workId}}),this.prisma.certificate.findMany({where:{workId,deletedAt:null,status:{not:RecordStatus.VOID}}})]);
    if(!work) return; const collected=certs.reduce((s,x)=>s+Number(x.collectedAmount),0); const certified=certs.reduce((s,x)=>s+Number(x.grossAmount),0);
    await this.prisma.work.update({where:{id:workId},data:{collectedAmount:collected,financialProgress:Number(work.contractAmount)>0?(certified/Number(work.contractAmount))*100:0}});
  }
  private async addWorkCost(workId:string,amount:number){if(!amount)return;await this.prisma.work.update({where:{id:workId},data:{actualCost:{increment:amount}}});}
  private async requireWork(companyId:string,id:string){const w=await this.prisma.work.findFirst({where:{id,companyId,deletedAt:null}});if(!w)throw new NotFoundException("Obra no encontrada");}
  private async employeeId(v:unknown){const raw=this.str(v);if(!raw)throw new BadRequestException("Empleado requerido");const e=await this.prisma.employee.findFirst({where:{active:true,OR:[{employeeNumber:raw},{firstName:{contains:raw,mode:"insensitive"}},{lastName:{contains:raw,mode:"insensitive"}}]}});if(!e)throw new NotFoundException("Empleado no encontrado");return e.id;}
  private row(id:string,code:string,title:string,status:RecordStatus,amount:unknown,date:Date|null|undefined,owner:string,work:{code:string;name?:string}|null,data:Record<string,unknown>){return{id,code,title,status,amount,occurredAt:date,updatedAt:date??new Date(0),createdById:owner,work,data};}
  private num(v:unknown){const n=Number(v??0);return Number.isFinite(n)?n:0;} private int(v:unknown){return Math.trunc(this.num(v));}
  private str(v:unknown){return v===undefined||v===null||v===""?undefined:String(v).trim();} private bool(v:unknown,f=false){if(typeof v==="boolean")return v;if(v===undefined||v===null||v==="")return f;return ["sí","si","true","1","activo","aprobado"].includes(String(v).toLowerCase());}
  private date(v:unknown){if(!v)return undefined;const d=new Date(String(v));return Number.isNaN(d.getTime())?undefined:d;} private reqDate(v:unknown,l:string){const d=this.date(v);if(!d)throw new BadRequestException(`${l} inválida`);return d;}
  private json(v:unknown):Prisma.InputJsonValue{if(Array.isArray(v)||typeof v==="object"&&v!==null)return v as Prisma.InputJsonValue;if(v===undefined||v===null||v==="")return [];return [String(v)] as Prisma.InputJsonValue;}
}
