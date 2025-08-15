import { getAllUsers, isMasterAdmin } from "@/server/users";
import { getAllOrganizationsWithMembers } from "@/server/organizations";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addUserToOrgAdmin,
  createOrganizationAdmin,
  createUserAdmin,
  deleteOrganizationAdmin,
  deleteUserAdmin,
  removeUserFromOrgAdmin,
  setMemberRoleAdmin,
  getAllowSignupsAdmin,
  setAllowSignupsAdmin,
} from "@/server/admin";

// Server action wrappers to handle FormData and revalidate
async function createOrgAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  if (!name || !slug) return;
  await createOrganizationAdmin({ name, slug });
  revalidatePath("/super-admin");
}

async function deleteOrgAction(formData: FormData) {
  "use server";
  const orgId = String(formData.get("orgId") || "");
  if (!orgId) return;
  await deleteOrganizationAdmin(orgId);
  revalidatePath("/super-admin");
}

async function createUserAction(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  if (!name || !email) return;
  await createUserAdmin({ name, email });
  revalidatePath("/super-admin");
}

async function deleteUserAction(formData: FormData) {
  "use server";
  const userId = String(formData.get("userId") || "");
  if (!userId) return;
  await deleteUserAdmin(userId);
  revalidatePath("/super-admin");
}

async function addUserToOrgAction(formData: FormData) {
  "use server";
  const orgId = String(formData.get("orgId") || "");
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "member") as "member" | "admin" | "owner";
  if (!orgId || !userId) return;
  await addUserToOrgAdmin({ orgId, userId, role });
  revalidatePath("/super-admin");
}

async function removeUserFromOrgAction(formData: FormData) {
  "use server";
  const orgId = String(formData.get("orgId") || "");
  const userId = String(formData.get("userId") || "");
  if (!orgId || !userId) return;
  await removeUserFromOrgAdmin({ orgId, userId });
  revalidatePath("/super-admin");
}

async function setMemberRoleAction(formData: FormData) {
  "use server";
  const orgId = String(formData.get("orgId") || "");
  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "member") as "member" | "admin" | "owner";
  if (!orgId || !userId) return;
  await setMemberRoleAdmin({ orgId, userId, role });
  revalidatePath("/super-admin");
}

async function toggleSignupsAction(formData: FormData) {
  "use server";
  const allow = String(formData.get("allowSignups") || "false") === "true";
  await setAllowSignupsAdmin(allow);
  revalidatePath("/super-admin");
}

export default async function SuperAdminPage() {
  const allowed = await isMasterAdmin();
  if (!allowed) redirect("/landing");

  const users = await getAllUsers();
  const orgs = await getAllOrganizationsWithMembers();
  const signups = await getAllowSignupsAdmin();

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-8">
      <h1 className="text-3xl font-bold">Master Admin</h1>

      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-3">Global settings</h2>
        <form action={toggleSignupsAction} className="flex items-center gap-3">
          <input type="hidden" name="allowSignups" value={String(!signups.allow)} />
          <div className="text-sm">
            Sign-ups are currently <span className={signups.allow ? "text-green-600" : "text-red-600"}>{signups.allow ? "ENABLED" : "DISABLED"}</span>
          </div>
          <Button type="submit" variant="outline">{signups.allow ? "Disable" : "Enable"} sign-ups</Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-3">Create Organisation</h2>
        <form action={createOrgAction} className="flex flex-col gap-3 max-w-md">
          <div className="grid gap-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input id="org-name" name="name" placeholder="Acme Inc" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="org-slug">Slug</Label>
            <Input id="org-slug" name="slug" placeholder="acme" required />
          </div>
          <div>
            <Button type="submit">Create organisation</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-3">Organisations</h2>
        {!orgs.length ? (
          <p className="text-sm text-muted-foreground">No organisations.</p>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {orgs.map((o) => (
              <AccordionItem key={o.id} value={o.id}>
                <AccordionTrigger value={o.id} className="text-left">
                  <div className="flex w-full items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{o.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{o.slug || "(no slug)"}</div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">{o.members?.length || 0} members</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent value={o.id}>
                  {!o.members?.length ? (
                    <p className="text-sm text-muted-foreground">No members.</p>
                  ) : (
                    <div className="mt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="w-40">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {o.members.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell>{m.user?.name}</TableCell>
                              <TableCell>{m.user?.email}</TableCell>
                              <TableCell className="capitalize">
                                <form action={setMemberRoleAction} className="flex items-center gap-2">
                                  <input type="hidden" name="orgId" value={o.id} />
                                  <input type="hidden" name="userId" value={m.userId} />
                                  <select
                                    name="role"
                                    defaultValue={m.role}
                                    className="h-8 min-w-28 rounded-md border border-input bg-transparent px-2 text-sm"
                                  >
                                    <option value="member">member</option>
                                    <option value="admin">admin</option>
                                    <option value="owner">owner</option>
                                  </select>
                                  <Button type="submit" size="sm" variant="outline">Update</Button>
                                </form>
                              </TableCell>
                              <TableCell>
                                <form action={removeUserFromOrgAction}>
                                  <input type="hidden" name="orgId" value={o.id} />
                                  <input type="hidden" name="userId" value={m.userId} />
                                  <Button type="submit" size="sm" variant="destructive">Remove</Button>
                                </form>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Add user to org */}
                  <div className="mt-4 border-t pt-4">
                    <h3 className="font-medium mb-2">Add user</h3>
                    <form action={addUserToOrgAction} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="orgId" value={o.id} />
                      <div className="grid gap-1.5">
                        <Label>User</Label>
                        <select name="userId" className="min-w-56 h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                          <option value="">Select a user</option>
                          {users
                            .filter((u) => !(o.members || []).some((mm) => mm.userId === u.id))
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {(u.name || u.email) + " — " + u.email}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Role</Label>
                        <select name="role" defaultValue="member" className="min-w-28 h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                          <option value="owner">owner</option>
                        </select>
                      </div>
                      <Button type="submit">Add</Button>
                    </form>
                  </div>

                  {/* Danger zone for org */}
                  <div className="mt-6 border-t pt-4">
                    <form action={deleteOrgAction} className="flex items-center justify-end">
                      <input type="hidden" name="orgId" value={o.id} />
                      <Button type="submit" variant="destructive">Delete organisation</Button>
                    </form>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-3">All Users</h2>
        <form action={createUserAction} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 max-w-2xl">
          <div className="grid gap-1.5">
            <Label htmlFor="user-name">Name</Label>
            <Input id="user-name" name="name" placeholder="Jane Doe" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" name="email" placeholder="jane@example.com" required />
          </div>
          <div className="flex items-end">
            <Button type="submit">Create user</Button>
          </div>
        </form>
        {!users.length ? (
          <p className="text-sm text-muted-foreground">No users.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <form action={deleteUserAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button type="submit" size="sm" variant="destructive">Delete</Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
