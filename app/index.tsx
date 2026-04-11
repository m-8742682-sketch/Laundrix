import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";

export default function Index() {
  // FIX: 移除所有路由逻辑，让_layout.tsx全权处理
  // 这个组件现在只作为入口点，不做任何重定向
  return null;
}