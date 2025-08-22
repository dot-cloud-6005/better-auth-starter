"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Member } from "@/db/schema";
import MembersTableAction from "./members-table-action";

interface MembersTableProps {
  members: Member[];
}

export default function MembersTable({ members }: MembersTableProps) {
  return (
    <Table>
      <TableCaption className="text-muted-foreground">A list of organisation members.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px] text-foreground">Username</TableHead>
          <TableHead className="text-foreground">Email</TableHead>
          <TableHead className="text-foreground">Role</TableHead>
          <TableHead className="text-right text-foreground">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium text-foreground">{member.user.name}</TableCell>
            <TableCell className="text-foreground">{member.user.email}</TableCell>
            <TableCell className="text-foreground">{member.role}</TableCell>
            <TableCell className="text-right">
              <MembersTableAction memberId={member.id} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
