/*! @license © 2026 Mia Spasovska. EACore design system (CORE) and front-end specification (FE) — author: Mia Spasovska. All rights reserved unless agreed otherwise in writing. Fingerprint EAC-MS-C226E467F1A53502. */
/** One icon set (CORE: Solar "-linear", self-hosted sprite in public/icons/solar-sprite.svg, CC BY 4.0).
 * The exports keep the names the screens already use, so a screen imports `Bell` and gets the Solar bell. */
import type { ReactElement, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { "aria-hidden"?: boolean | "true" | "false" };
export type LucideIcon = (props: IconProps) => ReactElement;

/** A Solar icon by its sprite id. Decorative (aria-hidden) unless the caller passes an aria-label. */
export function icon(id: string): LucideIcon {
  const Icon = ({ className, ...rest }: IconProps) => (
    <svg className={`ea-icon${className ? ` ${className}` : ""}`} aria-hidden={rest["aria-label"] ? undefined : true} focusable="false" {...rest}>
      <use href={`/icons/solar-sprite.svg#${id}`} />
    </svg>
  );
  Icon.displayName = `Icon(${id})`;
  return Icon;
}

export const AlertTriangle = icon("danger-triangle-linear");
export const Archive = icon("archive-linear");
export const ArrowDown = icon("arrow-down-linear");
export const ArrowDownRight = icon("arrow-right-down-linear");
export const ArrowUp = icon("arrow-up-linear");
export const ArrowUpRight = icon("arrow-right-up-linear");
export const BarChart3 = icon("chart-2-linear");
export const Bell = icon("bell-linear");
export const BookOpen = icon("book-2-linear");
export const Building = icon("buildings-linear");
export const Building2 = icon("buildings-2-linear");
export const ChartLine = icon("graph-up-linear");
export const Check = icon("check-linear");
export const CheckCheck = icon("check-read-linear");
export const CheckCircle2 = icon("check-circle-linear");
export const ChevronDown = icon("alt-arrow-down-linear");
export const ChevronLeft = icon("alt-arrow-left-linear");
export const ChevronRight = icon("alt-arrow-right-linear");
export const Circle = icon("record-linear");
export const Clock = icon("clock-circle-linear");
export const Columns3 = icon("columns-3-linear");
export const Compass = icon("compass-linear");
export const Construction = icon("case-linear");
export const CornerUpLeft = icon("undo-left-linear");
export const Download = icon("download-minimalistic-linear");
export const ExternalLink = icon("square-arrow-right-up-linear");
export const Eye = icon("eye-linear");
export const FileSignature = icon("document-text-linear");
export const FileSpreadsheet = icon("file-text-linear");
export const FileText = icon("document-text-linear");
export const Filter = icon("filter-linear");
export const Handshake = icon("users-group-two-rounded-linear");
export const HardHat = icon("clipboard-list-linear");
export const History = icon("history-linear");
export const House = icon("home-2-linear");
export const Inbox = icon("inbox-linear");
export const Info = icon("info-circle-linear");
export const Keyboard = icon("keyboard-linear");
export const LayoutGrid = icon("widget-linear");
export const Lock = icon("lock-keyhole-linear");
export const LogIn = icon("login-3-linear");
export const LogOut = icon("logout-2-linear");
export const Menu = icon("hamburger-menu-linear");
export const MessageSquare = icon("chat-square-line-linear");
export const Monitor = icon("monitor-linear");
export const Moon = icon("moon-linear");
export const MoreHorizontal = icon("menu-dots-bold");
export const PanelLeft = icon("alt-arrow-right-linear");
export const PanelLeftClose = icon("alt-arrow-left-linear");
export const Paperclip = icon("paperclip-linear");
export const Pencil = icon("pen-linear");
export const Pin = icon("pin-linear");
export const Plus = icon("add-linear");
export const Printer = icon("printer-minimalistic-linear");
export const RefreshCw = icon("refresh-linear");
export const Rows3 = icon("list-linear");
export const Rows4 = icon("hamburger-menu-linear");
export const Save = icon("diskette-linear");
export const Search = icon("magnifier-linear");
export const SearchX = icon("magnifier-zoom-out-linear");
export const Send = icon("plain-linear");
export const Settings = icon("settings-linear");
export const ShoppingCart = icon("cart-large-minimalistic-linear");
export const Star = icon("star-linear");
export const Sun = icon("sun-linear");
export const Table2 = icon("list-linear");
export const Trash2 = icon("trash-bin-minimalistic-linear");
export const Truck = icon("car-linear");
export const Upload = icon("upload-minimalistic-linear");
export const User = icon("user-linear");
export const Users = icon("users-group-rounded-linear");
export const Wallet = icon("wallet-money-linear");
export const Warehouse = icon("box-linear");
export const X = icon("close-linear");
export const XCircle = icon("close-circle-linear");
export const Database = icon("database-linear");
export const Folder = icon("folder-linear");
export const Card = icon("card-linear");
