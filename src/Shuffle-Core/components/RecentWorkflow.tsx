// @ts-nocheck
/**
 * RecentWorkflow — list item used by FormInput's sidebar / explorer to render
 * a single recent workflow (form). Ported from Shuffle Core's
 * `RecentWorkflow.jsx`. Self-contained: no external Shuffle Core deps.
 */
import React, { useContext } from "react";
import { Link } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Typography,
  Tooltip,
} from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";
import { getTheme, Context } from "./stubs";

interface RecentWorkflowProps {
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
  const { themeMode, brandColor } = useContext(Context);
  const theme = getTheme(themeMode, brandColor);

  const [hovered, setHovered] = React.useState(false);
  if (!workflow) return null;

  const expandLeftNav = leftNavOpen === true || leftNavOpen === undefined;

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

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Link to={`/forms/${workflow?.id}`} style={{ textDecoration: "none" }}>
        <Button
          onClick={(e) => {
            if (onclickHandler) {
              e.preventDefault();
              e.stopPropagation();
              onclickHandler();
            }
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            textTransform: "none",
            width: "100%",
            justifyContent: "flex-start",
            textAlign: "left",
            opacity: expandLeftNav ? 1 : 0,
            transition: "opacity 0.1s",
            borderRadius: theme.palette?.borderRadius,
            backgroundColor:
              hovered || currentWorkflowId === workflow.id
                ? theme.palette.hoverColor
                : "transparent",
          }}
          disableRipple
        >
          <Box style={{ display: "flex", marginRight: "auto", alignItems: "center", position: "relative" }}>
            {relevantImageUrl ? (
              <Avatar
                alt={workflow?.name}
                src={relevantImageUrl}
                style={{ width: 24, height: 24, marginRight: 5 }}
              />
            ) : (
              workflow?.apps?.slice(0, 2).map((data: any, index: number) => (
                <Box key={index} style={{ position: "relative", marginLeft: index === 1 ? -8 : 0 }}>
                  <Avatar
                    alt={data.app_name}
                    src={data.large_image ? data.large_image : "/images/no_image.png"}
                    style={{ width: 24, height: 24 }}
                  />
                </Box>
              ))
            )}
            <Typography
              style={{
                fontSize: 16,
                marginLeft: 8,
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {workflow?.name}
            </Typography>

            {onclickHandler !== undefined && workflow.sharing !== "form" ? (
              <Tooltip title="Private Org Form" placement="right">
                <LockIcon
                  style={{
                    height: 15,
                    width: 15,
                    color: "hsl(var(--muted-foreground))",
                    position: "absolute",
                    left: -17,
                  }}
                />
              </Tooltip>
            ) : null}
          </Box>
        </Button>
      </Link>
    </div>
  );
};

export default RecentWorkflow;
