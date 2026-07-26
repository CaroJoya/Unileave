// components/headclerk/EmployeeLeaveCard.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

interface LeaveRecordItem {
  id: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  alternateFacultyName?: string;
  workedOnDate?: string;
}

interface EmployeeLeaveCardProps {
  data: {
    academicYear: string;
    employee: {
      employeeId: string;
      name: string;
      designation: string;
      departmentName: string;
      mobileNumber: string;
      doj: string;
      address: string;
      bloodGroup: string;
      email: string;
      pincode: string;
    };
    balances: {
      CL: number;
      SL: number;
      EL: number;
      VACATION: number;
      LWP: number;
      janBalance: number;
      julyBalance: number;
    };
    vacationSlots: {
      slot1: { from: string; to: string };
      slot2: { from: string; to: string };
    };
    records: {
      CL: LeaveRecordItem[];
      EL: LeaveRecordItem[];
      VACATION: LeaveRecordItem[];
      CO: LeaveRecordItem[];
      LWP: LeaveRecordItem[];
      ML: LeaveRecordItem[];
      OD: LeaveRecordItem[];
      compOffCredits?: { earnedDate: string; creditedDays: number }[];
    };
  };
  onBack?: () => void;
}

export function EmployeeLeaveCard({ data, onBack }: EmployeeLeaveCardProps) {
  const { employee, balances, vacationSlots, records, academicYear } = data;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const padRows = (arr: LeaveRecordItem[], targetLength: number) => {
    const padded = [...arr];
    while (padded.length < targetLength) {
      padded.push({
        id: `empty-${padded.length}`,
        createdAt: "",
        startDate: "",
        endDate: "",
        totalDays: 0,
        reason: "",
        alternateFacultyName: "",
      });
    }
    return padded;
  };

  return (
    <div className="bg-white text-black p-4 md:p-8 max-w-5xl mx-auto space-y-8 print:p-0 print:max-w-none font-serif text-xs">
      {/* Top Controls */}
      <div className="flex justify-between items-center print:hidden mb-6 border-b pb-4 font-sans">
        {onBack && (
          <Button variant="outline" onClick={onBack} size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to List
          </Button>
        )}
        <h2 className="text-lg font-bold text-slate-800">
          Employee Leave Card View
        </h2>
        <Button onClick={() => window.print()} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Printer className="w-4 h-4" /> Print Leave Card
        </Button>
      </div>

      {/* PAGE 1: HEADER & CASUAL LEAVE RECORD */}
      <div className="border-2 border-black p-3 space-y-3 page-break-after">
        {/* COLLEGE HEADER */}
        <div className="text-center border-b-2 border-black pb-2 space-y-1">
          <h1 className="text-base font-bold tracking-wide uppercase">
            Mahatma Education Society&apos;s Pillai College of Engineering
          </h1>
          <p className="text-[10px] font-sans italic">(Autonomous)</p>
          <p className="text-[9px] font-sans">
            Dr. K. M. Vasudevan Pillai Campus, Sector 16, New Panvel, Navi Mumbai - 410206
          </p>
          <div className="border-t border-black pt-1 mt-1 font-bold text-sm tracking-wider">
            EMPLOYEE LEAVE CARD
          </div>
        </div>

        {/* EMPLOYEE DETAILS GRID */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b-2 border-black pb-2 text-[11px] leading-tight">
          <div>
            <span className="font-bold">EMPLOYEE ID:</span> {employee.employeeId}
          </div>
          <div>
            <span className="font-bold">ACADEMIC YEAR:</span> {academicYear}
          </div>
          <div>
            <span className="font-bold">Name:</span> Mr./Ms. {employee.name}
          </div>
          <div>
            <span className="font-bold">Designation:</span> {employee.designation}
          </div>
          <div>
            <span className="font-bold">Department:</span> {employee.departmentName}
          </div>
          <div>
            <span className="font-bold">D.O.J.:</span> {employee.doj}
          </div>
          <div>
            <span className="font-bold">Mobile No.:</span> {employee.mobileNumber}
          </div>
          <div>
            <span className="font-bold">Blood Group:</span> {employee.bloodGroup}
          </div>
          <div className="col-span-2">
            <span className="font-bold">Address for Communication:</span> {employee.address} (Pincode: {employee.pincode})
          </div>
          <div className="col-span-2">
            <span className="font-bold">Email Id:</span> {employee.email}
          </div>
        </div>

        {/* CASUAL LEAVE RECORD (MAXIMUM 08) */}
        <div>
          <div className="font-bold uppercase text-center py-1 bg-gray-100 border border-black mb-1">
            CASUAL LEAVE RECORD (Maximum 08)
          </div>
          <table className="w-full border-collapse border border-black text-center text-[10px]">
            <thead>
              <tr className="bg-gray-50 border-b border-black">
                <th className="border border-black p-1 w-6">S N</th>
                <th className="border border-black p-1">Date of Appl.</th>
                <th className="border border-black p-1">Leave Req (From)</th>
                <th className="border border-black p-1">Leave Req (To)</th>
                <th className="border border-black p-1">Total No. of Days</th>
                <th className="border border-black p-1">Reason for Absence</th>
                <th className="border border-black p-1">Alternative Arr.</th>
                <th className="border border-black p-1">Sign of Applic.</th>
                <th className="border border-black p-1">Sign of HOD</th>
                <th className="border border-black p-1">Sign of Alt.</th>
                <th className="border border-black p-1">Office Staff Initials</th>
                <th className="border border-black p-1">Approval of Principal</th>
              </tr>
            </thead>
            <tbody>
              {padRows(records.CL, 4).map((row, idx) => (
                <tr key={row.id || idx} className="h-6">
                  <td className="border border-black">{idx + 1}</td>
                  <td className="border border-black">{formatDate(row.createdAt)}</td>
                  <td className="border border-black">{formatDate(row.startDate)}</td>
                  <td className="border border-black">{formatDate(row.endDate)}</td>
                  <td className="border border-black">{row.totalDays || ""}</td>
                  <td className="border border-black text-left px-1">{row.reason}</td>
                  <td className="border border-black">{row.alternateFacultyName || ""}</td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[9px] italic border-t border-black pt-1 mt-1">
            [Footer Note]: No CL during first 3 months. CL and SL cannot be combined. Exam section approval required.
          </div>
          <div className="border border-black p-1 mt-1 font-bold text-center text-[10px]">
            [OFFICE USE]: CL: {balances.CL} | SL: {balances.SL} | EL: {balances.EL} | VACATION: {balances.VACATION} | LWP: {balances.LWP}
          </div>
        </div>
      </div>

      {/* PAGE 2: EARNED LEAVE & VACATION RECORD */}
      <div className="border-2 border-black p-3 space-y-3">
        {/* EARNED LEAVE RECORD */}
        <div>
          <div className="font-bold uppercase text-center py-1 bg-gray-100 border border-black mb-1">
            EARNED LEAVE RECORD
          </div>
          <div className="flex justify-between px-2 py-1 font-bold border border-black mb-1 text-[10px]">
            <span>Balance in January: {balances.janBalance}</span>
            <span>Balance in July: {balances.julyBalance}</span>
          </div>
          <table className="w-full border-collapse border border-black text-center text-[10px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-black p-1 w-6">S N</th>
                <th className="border border-black p-1">Date of Appl.</th>
                <th className="border border-black p-1">Leave Req (From)</th>
                <th className="border border-black p-1">Leave Req (To)</th>
                <th className="border border-black p-1">Total No. of Days</th>
                <th className="border border-black p-1">Reason for Absence</th>
                <th className="border border-black p-1">Alternative Arr.</th>
                <th className="border border-black p-1">Sign of Applic.</th>
                <th className="border border-black p-1">Sign of HOD</th>
                <th className="border border-black p-1">Sign of Alt.</th>
                <th className="border border-black p-1">Bal</th>
                <th className="border border-black p-1">Approval of Principal</th>
              </tr>
            </thead>
            <tbody>
              {padRows(records.EL, 8).map((row, idx) => (
                <tr key={row.id || idx} className="h-6">
                  <td className="border border-black">{idx + 1}</td>
                  <td className="border border-black">{formatDate(row.createdAt)}</td>
                  <td className="border border-black">{formatDate(row.startDate)}</td>
                  <td className="border border-black">{formatDate(row.endDate)}</td>
                  <td className="border border-black">{row.totalDays || ""}</td>
                  <td className="border border-black text-left px-1">{row.reason}</td>
                  <td className="border border-black">{row.alternateFacultyName || ""}</td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[9px] italic border-t border-black pt-1 mt-1">
            [Footer Note]: EL must be pre-sanctioned. Cannot combine with CL or Vacation. Exam section approval during exams.
          </div>
        </div>

        {/* VACATION RECORD */}
        <div>
          <div className="font-bold uppercase text-center py-1 bg-gray-100 border border-black mb-1">
            VACATION RECORD
          </div>
          <div className="flex justify-between px-2 py-1 font-bold border border-black mb-1 text-[10px]">
            <span>Slot 1: {vacationSlots.slot1.from} to {vacationSlots.slot1.to}</span>
            <span>Slot 2: {vacationSlots.slot2.from} to {vacationSlots.slot2.to}</span>
          </div>
          <table className="w-full border-collapse border border-black text-center text-[10px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-black p-1 w-6">S N</th>
                <th className="border border-black p-1">Date of Appl.</th>
                <th className="border border-black p-1">Leave Req (From)</th>
                <th className="border border-black p-1">Leave Req (To)</th>
                <th className="border border-black p-1">Total No. of Days</th>
                <th className="border border-black p-1">Reason for Absence</th>
                <th className="border border-black p-1">Alternative Arr.</th>
                <th className="border border-black p-1">Sign of Applic.</th>
                <th className="border border-black p-1">Sign of HOD</th>
                <th className="border border-black p-1">Sign of Alt.</th>
                <th className="border border-black p-1">Bal</th>
                <th className="border border-black p-1">Approval of Principal</th>
              </tr>
            </thead>
            <tbody>
              {padRows(records.VACATION, 6).map((row, idx) => (
                <tr key={row.id || idx} className="h-6">
                  <td className="border border-black">{idx + 1}</td>
                  <td className="border border-black">{formatDate(row.createdAt)}</td>
                  <td className="border border-black">{formatDate(row.startDate)}</td>
                  <td className="border border-black">{formatDate(row.endDate)}</td>
                  <td className="border border-black">{row.totalDays || ""}</td>
                  <td className="border border-black text-left px-1">{row.reason}</td>
                  <td className="border border-black">{row.alternateFacultyName || ""}</td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[9px] italic border-t border-black pt-1 mt-1">
            [Footer Note]: All vacation must be pre-sanctioned by competent authority and approved by exam section.
          </div>
        </div>
      </div>

      {/* PAGE 3: C.OFF, LWP & MEDICAL LEAVE */}
      <div className="border-2 border-black p-3 space-y-3">
        {/* C. OFF RECORD */}
        <div>
          <div className="font-bold uppercase text-center py-1 bg-gray-100 border border-black mb-1">
            C. OFF RECORD
          </div>
          <table className="w-full border-collapse border border-black text-center text-[10px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-black p-1 w-6">S N</th>
                <th className="border border-black p-1">Date of Appl.</th>
                <th className="border border-black p-1">Leave Req (From)</th>
                <th className="border border-black p-1">Leave Req (To)</th>
                <th className="border border-black p-1">Worked on</th>
                <th className="border border-black p-1">Total No. of Days</th>
                <th className="border border-black p-1">Reason for Absence</th>
                <th className="border border-black p-1">Alternative Arr.</th>
                <th className="border border-black p-1">Sign of Applic.</th>
                <th className="border border-black p-1">Sign of HOD</th>
                <th className="border border-black p-1">Office Staff Initials</th>
                <th className="border border-black p-1">Approval of Principal</th>
              </tr>
            </thead>
            <tbody>
              {padRows(records.CO, 6).map((row, idx) => {
                const creditEarned = records.compOffCredits?.[idx]?.earnedDate;
                return (
                  <tr key={row.id || idx} className="h-6">
                    <td className="border border-black">{idx + 1}</td>
                    <td className="border border-black">{formatDate(row.createdAt)}</td>
                    <td className="border border-black">{formatDate(row.startDate)}</td>
                    <td className="border border-black">{formatDate(row.endDate)}</td>
                    <td className="border border-black">{creditEarned ? formatDate(creditEarned) : ""}</td>
                    <td className="border border-black">{row.totalDays || ""}</td>
                    <td className="border border-black text-left px-1">{row.reason}</td>
                    <td className="border border-black">{row.alternateFacultyName || ""}</td>
                    <td className="border border-black"></td>
                    <td className="border border-black"></td>
                    <td className="border border-black"></td>
                    <td className="border border-black"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* LEAVE WITHOUT PAY (LWP) RECORD */}
        <div>
          <div className="font-bold uppercase text-center py-1 bg-gray-100 border border-black mb-1">
            LEAVE WITHOUT PAY (LWP) RECORD
          </div>
          <table className="w-full border-collapse border border-black text-center text-[10px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-black p-1 w-6">S N</th>
                <th className="border border-black p-1">Date of Appl.</th>
                <th className="border border-black p-1">Leave Req (From)</th>
                <th className="border border-black p-1">Leave Req (To)</th>
                <th className="border border-black p-1">Total No. of Days</th>
                <th className="border border-black p-1">Reason for Absence</th>
                <th className="border border-black p-1">Alternative Arr.</th>
                <th className="border border-black p-1">Sign of Applic.</th>
                <th className="border border-black p-1">Sign of HOD</th>
                <th className="border border-black p-1">Sign of Alt.</th>
                <th className="border border-black p-1">Office Staff Initials</th>
                <th className="border border-black p-1">Approval of Principal</th>
              </tr>
            </thead>
            <tbody>
              {padRows(records.LWP, 4).map((row, idx) => (
                <tr key={row.id || idx} className="h-6">
                  <td className="border border-black">{idx + 1}</td>
                  <td className="border border-black">{formatDate(row.createdAt)}</td>
                  <td className="border border-black">{formatDate(row.startDate)}</td>
                  <td className="border border-black">{formatDate(row.endDate)}</td>
                  <td className="border border-black">{row.totalDays || ""}</td>
                  <td className="border border-black text-left px-1">{row.reason}</td>
                  <td className="border border-black">{row.alternateFacultyName || ""}</td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[9px] italic border-t border-black pt-1 mt-1">
            [Note]: LWP needs to be sanctioned.
          </div>
        </div>

        {/* MEDICAL LEAVE RECORD */}
        <div>
          <div className="font-bold uppercase text-center py-1 bg-gray-100 border border-black mb-1">
            MEDICAL LEAVE RECORD
          </div>
          <table className="w-full border-collapse border border-black text-center text-[10px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-black p-1 w-6">S N</th>
                <th className="border border-black p-1">Date of Appl.</th>
                <th className="border border-black p-1">Leave Req (From)</th>
                <th className="border border-black p-1">Leave Req (To)</th>
                <th className="border border-black p-1">Total No. of Days</th>
                <th className="border border-black p-1">Reason for Absence</th>
                <th className="border border-black p-1">Alternative Arr.</th>
                <th className="border border-black p-1">Sign of Applic.</th>
                <th className="border border-black p-1">Sign of HOD</th>
                <th className="border border-black p-1">Sign of Alt.</th>
                <th className="border border-black p-1">Office Staff Initials</th>
                <th className="border border-black p-1">Bal</th>
                <th className="border border-black p-1">Approval of Principal</th>
              </tr>
            </thead>
            <tbody>
              {padRows(records.ML, 4).map((row, idx) => (
                <tr key={row.id || idx} className="h-6">
                  <td className="border border-black">{idx + 1}</td>
                  <td className="border border-black">{formatDate(row.createdAt)}</td>
                  <td className="border border-black">{formatDate(row.startDate)}</td>
                  <td className="border border-black">{formatDate(row.endDate)}</td>
                  <td className="border border-black">{row.totalDays || ""}</td>
                  <td className="border border-black text-left px-1">{row.reason}</td>
                  <td className="border border-black">{row.alternateFacultyName || ""}</td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[9px] italic border-t border-black pt-1 mt-1">
            [Footer Note]: Communication allowed if sickness exceeds 3 days. No SL during first year. Medical leave without certificate = Half Pay.
          </div>
          <div className="border border-black p-1 mt-1 font-bold text-center text-[10px]">
            [OFFICE USE]: CL: {balances.CL} | SL: {balances.SL} | EL: {balances.EL} | VACATION: {balances.VACATION} | LWP: {balances.LWP}
          </div>
        </div>
      </div>

      {/* PAGE 4: ON DUTY (OD) RECORD */}
      <div className="border-2 border-black p-3 space-y-3">
        <div>
          <div className="font-bold uppercase text-center py-1 bg-gray-100 border border-black mb-1">
            OD RECORD
          </div>
          <table className="w-full border-collapse border border-black text-center text-[10px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-black p-1 w-6">S N</th>
                <th className="border border-black p-1">Date of Appl.</th>
                <th className="border border-black p-1">Leave Req (From)</th>
                <th className="border border-black p-1">Leave Req (To)</th>
                <th className="border border-black p-1">Total No. of Days</th>
                <th className="border border-black p-1">Reason for Absence</th>
                <th className="border border-black p-1">Alternative Arr.</th>
                <th className="border border-black p-1">Sign of Applic.</th>
                <th className="border border-black p-1">Sign of HOD</th>
                <th className="border border-black p-1">Sign of Alt.</th>
                <th className="border border-black p-1">Office Staff Initials</th>
                <th className="border border-black p-1">Approval of Principal</th>
              </tr>
            </thead>
            <tbody>
              {padRows(records.OD, 12).map((row, idx) => (
                <tr key={row.id || idx} className="h-6">
                  <td className="border border-black">{idx + 1}</td>
                  <td className="border border-black">{formatDate(row.createdAt)}</td>
                  <td className="border border-black">{formatDate(row.startDate)}</td>
                  <td className="border border-black">{formatDate(row.endDate)}</td>
                  <td className="border border-black">{row.totalDays || ""}</td>
                  <td className="border border-black text-left px-1">{row.reason}</td>
                  <td className="border border-black">{row.alternateFacultyName || ""}</td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[9px] italic border-t border-black pt-1 mt-1">
            [Footer Note]: OD certificate must be attached. Alternate faculty must confirm no load in identified shift.
          </div>
        </div>
      </div>
    </div>
  );
}