// @ts-nocheck
/**
 * RecentWorkflow — list item used by FormInput's sidebar to render a single
 * recent workflow (form). Self-contained: no external Shuffle Core deps.
 *
 * Sized + colored using HSL tokens so it visually matches the rest of the
 * Shuffle Security shell. Hover uses a subtle neutral background — never the
 * brand orange — so the foreground text stays readable.
 */
import React from "react";
import { Lock as LockIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, Box, Tooltip, Typography } from "@mui/material";

export interface RecentWorkflowProps {
  workflow: any;
  onclickHandler?: () => void;
  leftNavOpen?: boolean;
  currentWorkflowId?: string;
}

const RecentWorkflow: React.FC<RecentWorkflowProps> = ({
  workflow,
  onclickHandler,
  leftNavOpen,
  currentWorkflowId,
}) => {
  const [hovered, setHovered] = React.useState(false);
  if (!workflow) return null;

  const expandLeftNav = leftNavOpen === true || leftNavOpen === undefined;
  const isActive = currentWorkflowId === workflow.id;
  const isPrivate = workflow?.sharing !== "form";

  // Pull a header image out of input_markdown (<img src="..."> or ![](src))
  let relevantImageUrl = "";
  const md = workflow?.form_control?.input_markdown;
  if (md) {
    const imgTag = md.match(/<img[^>]+>/g);
    if (imgTag) {
      const src = imgTag[0].match(/src="([^"]+)"/);
      if (src) relevantImageUrl = src[1];
    } else {
      const markdownTag = md.match(/!\[.*\]\(.*\)/g);
      if (markdownTag) {
        const src = markdownTag[0].match(/\(([^)]+)\)/);
        if (src) relevantImageUrl = src[1];
      }
    }
  }

  const background = isActive
    ? "hsl(var(--primary) / 0.12)"
    : hovered
    ? "hsl(var(--muted) / 0.6)"
    : "transparent";

  const border = isActive
    ? "1px solid hsl(var(--primary) / 0.35)"
    : "1px solid transparent";

  const textColor = isActive
    ? "hsl(var(--primary))"
    : "hsl(var(--foreground))";

  return (
    <Link
      to={`/forms/${workflow?.id}`}
      style={{ textDecoration: "none", display: "block" }}
      onClick={(e) => {
        if (onclickHandler) {
          e.preventDefault();
          e.stopPropagation();
          onclickHandler();
        }
      }}
    >
      <Box
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          width: "100%",
          height: 32,
          paddingX: 1,
          borderRadius: 1,
          backgroundColor: background,
          border,
          opacity: expandLeftNav ? 1 : 0,
          transition: "background-color 120ms, border-color 120ms, opacity 120ms",
          cursor: "pointer",
        }}
      >
        {isPrivate ? (
          <Tooltip title="Private org form" placement="right">
            <LockIcon
              size={12}
              style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }}
            />
          </Tooltip>
        ) : (
          <Box sx={{ width: 12, flexShrink: 0 }} />
        )}

        {relevantImageUrl ? (
          <Avatar
            alt={workflow?.name}
            src={relevantImageUrl}
            sx={{ width: 18, height: 18, flexShrink: 0 }}
          />
        ) : null}

        <Typography
          sx={{
            fontSize: 13,
            fontWeight: isActive ? 600 : 500,
            color: textColor,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {workflow?.name}
        </Typography>
      </Box>
    </Link>
  );
};

export default RecentWorkflow;
