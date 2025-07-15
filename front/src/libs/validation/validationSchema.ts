import { z } from "zod";

export const validationRegistSchema = z
  .object({
    email: z
      .string()
      .nonempty("メールアドレスを入力してください")
      .email("無効なメールアドレス形式です"),
    password: z
      .string()
      .nonempty("パスワードを入力してください")
      .min(8, "パスワードは8文字以上です"),
    passwordConfirm: z.string().nonempty("再確認パスワードを入力してください"),
  })
  .superRefine(({ password, passwordConfirm }, ctx) => {
    if (password !== passwordConfirm) {
      ctx.addIssue({
        code: "custom",
        message: "パスワードが一致しません",
        path: ["passwordConfirm"],
      });
    }
  });

export const validationLoginSchema = z.object({
  email: z.string().nonempty("メールアドレスを入力してください"),
  password: z.string().nonempty("パスワードを入力してください"),
});
