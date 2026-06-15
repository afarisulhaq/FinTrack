import bcrypt from "bcryptjs";
import { Elysia, t } from "elysia";
import { z } from "zod";
import { users } from "../data";
import { extractToken, signToken, verifyToken } from "../auth";
import { canUseDatabase, db as prisma } from "../prisma-client";
import { fail, id, ok, publicUser } from "../utils";
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});
const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
});
function publicPrismaUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
    };
}
export const authRoutes = new Elysia({ prefix: "/api/auth" })
    .post("/login", async ({ body, set }) => {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
        set.status = 400;
        return fail("Email/password tidak valid");
    }
    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    if (await canUseDatabase()) {
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            set.status = 401;
            return fail("Email atau password salah");
        }
        if (user.status !== "active") {
            set.status = 403;
            return fail("Akun tidak aktif");
        }
        const token = signToken({
            sub: user.id,
            email: user.email,
            role: user.role,
        });
        return ok({ token, user: publicPrismaUser(user) });
    }
    const user = users.find((u) => u.email === normalizedEmail);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        set.status = 401;
        return fail("Email atau password salah");
    }
    if (user.status !== "active") {
        set.status = 403;
        return fail("Akun tidak aktif");
    }
    const token = signToken({
        sub: user.id,
        email: user.email,
        role: user.role,
    });
    return ok({ token, user: publicUser(user) });
}, {
    body: t.Object({
        email: t.String(),
        password: t.String({ minLength: 6 }),
    }),
})
    .post("/register", async ({ body, set }) => {
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
        set.status = 400;
        return fail("Data registrasi tidak valid");
    }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const hashed = await bcrypt.hash(password, 10);
    if (await canUseDatabase()) {
        const exists = await prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (exists) {
            set.status = 409;
            return fail("Email sudah terdaftar");
        }
        const user = await prisma.user.create({
            data: {
                name,
                email: normalizedEmail,
                password: hashed,
                role: "owner",
                status: "active",
            },
        });
        const token = signToken({
            sub: user.id,
            email: user.email,
            role: user.role,
        });
        return ok({ token, user: publicPrismaUser(user) });
    }
    if (users.some((u) => u.email === normalizedEmail)) {
        set.status = 409;
        return fail("Email sudah terdaftar");
    }
    const newUser = {
        id: id("usr"),
        name,
        email: normalizedEmail,
        password: hashed,
        role: "owner",
        status: "active",
        createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    const token = signToken({
        sub: newUser.id,
        email: newUser.email,
        role: newUser.role,
    });
    return ok({ token, user: publicUser(newUser) });
}, {
    body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String(),
        password: t.String({ minLength: 6 }),
    }),
})
    .get("/me", async ({ request, set }) => {
    const token = extractToken(request.headers.get("authorization") ?? undefined);
    if (!token) {
        set.status = 401;
        return fail("Unauthorized");
    }
    const payload = verifyToken(token);
    if (!payload) {
        set.status = 401;
        return fail("Invalid token");
    }
    if (await canUseDatabase()) {
        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
        });
        if (!user) {
            set.status = 404;
            return fail("User tidak ditemukan");
        }
        return ok(publicPrismaUser(user));
    }
    const user = users.find((u) => u.id === payload.sub);
    if (!user) {
        set.status = 404;
        return fail("User tidak ditemukan");
    }
    return ok(publicUser(user));
});
