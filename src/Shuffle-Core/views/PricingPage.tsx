// @ts-nocheck
import React, { useEffect, useState } from "react";
import {
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Divider,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Minus, Info, Cloud as CloudLucide, Server as ServerLucide, Check as CheckLucide, MessageCircle, Mail as MailLucide, MessagesSquare } from "lucide-react";
import ReactGA from "react-ga4";
import ReactMarkdown from "react-markdown";
import { openSourcePlan, pricingPlansData, featuresData } from "../views/pricingData.js";

const PricingPage = ({
  theme,
  stripeKey,
  serverside,
  isLoggedIn,
  isLoaded,
  userdata,
  globalUrl,
}) => {
  const navigate = useNavigate();
  const isCloud =
    typeof window === "undefined" ||
    window === undefined ||
    window.location === undefined
      ? true
      : window.location.host === "localhost:3002" ||
        window.location.host === "shuffler.io";
  const [billingCycle, setBillingCycle] = useState(
    (typeof window !== "undefined" && window.location?.search) 
      ? new URLSearchParams(window.location.search).get("billing_cycle") || "annual"
      : "annual"
  );
  const [selectedDeployment, setSelectedDeployment] = useState(
    (typeof window !== "undefined" && window.location?.search)
      ? new URLSearchParams(window.location.search).get("env") || (isCloud ? "Cloud" : "Self-Hosted")
      : (isCloud ? "Cloud" : "Self-Hosted")
  ); // Could be Cloud or Self-Hosted
  const [selectedPlan, setSelectedPlan] = useState(
    selectedDeployment === "Self-Hosted" ? "open source" : "scale"
  );
  const [scaleValue, setScaleValue] = useState(
    (typeof window !== "undefined" && window.location?.search)
      ? new URLSearchParams(window.location.search).get("app_runs") || 10
      : 10
  );
  const [currentFeatureTitle, setCurrentFeatureTitle] =
    useState("Core Features");
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [calcAlerts, setCalcAlerts] = useState(500);
  const [calcMonitors, setCalcMonitors] = useState(20);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const CloudIcon = ({ selected }) => (
    <CloudLucide size={18} strokeWidth={1.5} color={selected ? "#222" : "#fff"} />
  );

  const SelfHostedIcon = ({ selected }) => (
    <ServerLucide size={18} strokeWidth={1.5} color={selected ? "#222" : "#fff"} />
  );


  // Handle billing cycle change
  const handleBillingCycleChange = (event, newValue) => {
    if (newValue !== null) {
      setBillingCycle(newValue);

      if(isCloud){
        ReactGA.event({
          category: 'NewPricingPage',
          action: 'Billing Cycle Changed',
          label: `${billingCycle} -> ${newValue}`,
        });
      }

      // Add billing cycle to URL query params
      const urlSearchParams = new URLSearchParams(window.location.search);
      urlSearchParams.set("billing_cycle", newValue);
      const newUrl = `${
        window.location.pathname
      }?${urlSearchParams.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }
  };

  const handlePlanChange = (event, newValue) => {
    if (newValue !== null) {

    if(isCloud){
      ReactGA.event({
        category: 'NewPricingPage',
        action: 'Mobile toggle plan changed',
        label: `${selectedPlan} -> ${newValue}`,
      });
    }
      setSelectedPlan(newValue);
    }
  };

  // Calculate discount based on billing cycle
  const getPrice = (basePrice) => {
    return Math.round(billingCycle === "annual" ? basePrice * 0.9 : basePrice); // 10% discount for annual
  };

  // Get filtered plans based on deployment
  const getFilteredPlans = () => {
    const processedOpenSourcePlan = {
      ...openSourcePlan,
      buttonAction: openSourceButtonAction
    };

    const plans = selectedDeployment === "Self-Hosted" 
      ? [processedOpenSourcePlan, pricingPlans[2]] // Open Source + Enterprise
      : pricingPlans; // Starter + Scale + Enterprise for Cloud
    
    // Add deploymentOptions to Enterprise plan for the features section toggle
    return plans.map(plan => {
      if (plan.type === "Enterprise") {
        return {
          ...plan,
          deploymentOptions: ["Cloud", "Self-Hosted"]
        };
      }
      return plan;
    });
  };

  // Filter features based on deployment
  const getFilteredFeatures = (feature) => {
    if (selectedDeployment === "Self-Hosted") {
      // For Self-Hosted, show only Open Source and Enterprise
      return feature.includedIn.filter(item => 
        item.plan === "Open Source" || item.plan === "Enterprise"
      );
    } else {
      // For Cloud, show all plans (Starter, Scale, Enterprise)
      return feature.includedIn.filter(item => 
        item.plan === "Starter" || item.plan === "Scale" || item.plan === "Enterprise"
      );
    }
  };

  // Handle slider change for Scale plan
  const handleScaleChange = (event, newValue) => {
    setScaleValue(newValue);

    // Add app runs to URL query params
    const urlSearchParams = new URLSearchParams(window.location.search);
    urlSearchParams.set("app_runs", newValue); // Convert to actual app runs (k to actual number)
    const newUrl = `${window.location.pathname}?${urlSearchParams.toString()}`;
    window.history.replaceState({}, "", newUrl);
  };

  // Common styles
  const cardStyle = {
    height: "100%",
    background: "linear-gradient(to right, #212121, #212121) padding-box",
    borderRadius: "16px",
    position: "relative",
    overflow: "hidden",
    fontFamily: theme.typography.fontFamily,
  };

  const recommendedCardStyle = {
    ...cardStyle,
    border: "none",
    // background:
    //   "linear-gradient(to right, #212121, #212121) padding-box, linear-gradient(90deg, #F86744 0%, #F34475 100%) border-box",
    borderWidth: "2px",
    borderStyle: "solid",
    borderTop: "none",
    borderColor: "transparent",
  };

  const itemStyle = {
    display: "flex",
    alignItems: "center",
    py: 1,
  };

  const checkIcon = <CheckLucide size={16} strokeWidth={3} color="#ffffff" aria-label="check" />;

  // Button actions for pricing plans
  const openSourceButtonAction = () => {
    if(isCloud){
      ReactGA.event({
        category: 'NewPricingPage',
        action: 'Open Source Plan Selected',
        label: 'Clicked Download',
      });
    }
    window.open(
      "https://github.com/Shuffle/Shuffle/blob/master/.github/install-guide.md",
      "_blank"
    );
  };

  const starterButtonAction = () => {
    if(isLoggedIn){
      return;
    }else if (isCloud) {
      ReactGA.event({
        category: 'NewPricingPage',
        action: 'Starter Plan Selected',
        label: 'Clicked Start for Free',
      });
      navigate("/register?view=pricing&message=Get started for free");
    } else {
      window.open(
        "https://github.com/Shuffle/Shuffle/blob/master/.github/install-guide.md",
        "_blank"
      );
    }
  };

  const scaleButtonAction = () => {
    if (isLoggedIn && isCloud) {
      ReactGA.event({
        category: 'NewPricingPage',
        action: 'Scale Plan Selected',
        label: 'User is logged in',
      });
      isLoggedInHandler();
    } else {
      if(isCloud){
        ReactGA.event({
          category: 'NewPricingPage',
          action: 'Scale Plan Selected',
          label: 'User is not logged in',
        });
        navigate(
          "/register?view=pricing&app_runs=" +
            scaleValue +
            "&billing_cycle=" +
            billingCycle +
            "&env=" +
            selectedDeployment
        );
      } else {
        window.open(
          "https://shuffler.io/register?view=pricing&app_runs=" +
            scaleValue +
            "&billing_cycle=" +
            billingCycle +
            "&env=" +
            selectedDeployment,
          "_blank"
        );
      }
    }
  };

  const enterpriseButtonAction = () => {
    if (selectedDeployment === "Cloud") {
      if(isCloud){
        ReactGA.event({
          category: 'NewPricingPage',
          action: 'Enterprise Plan Selected',
          label: 'Cloud',
        });
        navigate("/contact?category=cloud_enterprise_plan");
      }else{
        window.open("https://shuffler.io/contact?category=cloud_enterprise_plan", '_blank');
        return;
      } 
    } else {
      if(isCloud){
        ReactGA.event({
          category: 'NewPricingPage',
          action: 'Enterprise Plan Selected',
          label: 'Self-Hosted',
        });
        navigate("/contact?category=onprem_enterprise_plan");
      }else{
        window.open("https://shuffler.io/contact?category=onprem_enterprise_plan", '_blank');
        return;
      }
    }
  };

  // Process imported pricing plans with dynamic values and button actions
  const pricingPlans = pricingPlansData.map(plan => {
    switch(plan.type) {
      case "Scale":
        return {
          ...plan,
          price: getPrice(plan.price), // Apply discount calculation
          buttonText: isLoggedIn ? "Current Plan" : "Start for Free",
          secondaryButtonText: "Get more App Runs",
          buttonAction: starterButtonAction,
          secondaryButtonAction: scaleButtonAction,
        };
      case "Standard":
        return {
          ...plan,
          buttonAction: enterpriseButtonAction,
        };
      case "Enterprise":
        return {
          ...plan,
          title: selectedDeployment === "Cloud" ? "$2920" : plan.title,
          buttonAction: enterpriseButtonAction
        };
      default:
        return plan;
    }
  });



  useEffect(() => {
    const handleScroll = () => {
      const coreFeatures = document.getElementById("core-features");
      const blurImage = document.getElementById("blur-image");
      const coreFeaturesRect = coreFeatures.getBoundingClientRect();
      const endOfFeatures = document.getElementById("end-of-features");
      const endOfFeaturesRect = endOfFeatures.getBoundingClientRect();

      const isStuck = coreFeaturesRect.top === 70 || coreFeaturesRect.top === 60;
      if (isStuck) {
        coreFeatures.style.backgroundColor = "#1a1a1a";
        coreFeatures.style.boxShadow =
          "0 0 0 100vmax #1a1a1a, 0 5px 5px -5px rgba(0, 0, 0, 0.3)";
        coreFeatures.style.clipPath = "inset(0 -100vmax)";
        coreFeatures.style.marginLeft = "-16px";
        coreFeatures.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
        blurImage.style.display = "none";
      } else {
        coreFeatures.style.backgroundColor = "transparent";
        coreFeatures.style.boxShadow = "none";
        coreFeatures.style.clipPath = "none";
        blurImage.style.display = "block";
        coreFeatures.style.marginLeft = "-15px";
        coreFeatures.style.borderBottom = "none";
      }

      if (endOfFeaturesRect.top < window.innerHeight - 650) {
        coreFeatures.style.visibility = "hidden";
      } else {
        coreFeatures.style.visibility = "visible";
      }

      // // Check each feature title
      let newFeatureTitle = "Core Features"; // Default to Core Features
      featuresData.forEach((feature, index) => {
        const featureTitle = document.getElementById(`feature-title-${index}`); // Dynamic ID
        if (featureTitle) {
          const featureRect = featureTitle.getBoundingClientRect();
          if (featureRect.top < coreFeaturesRect.bottom) {
            newFeatureTitle = feature.title; // Update to the current feature title
          }
        }
      });

      // Set the state once after the loop
      setCurrentFeatureTitle(newFeatureTitle);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []); // Add featuresData as a dependency

  const FAQSection = () => {
    const faqs = [
      {
        question: "Can I use Shuffle on-premises or self-host?",
        answer:
          "Yes Shuffle can be deployed on-premises or self-hosted on your own choice of cloud platform like GCP, AWS, Azure, etc.",
      },
      {
        question: "Can I cancel my plan at any time?",
        answer:
          "Yes ofcourse, you can cancel your plan at any time from your admin section.",
      },
      {
        question: "What are app-runs?",
        answer:
          "App-runs are the actual automation/executions inside a workflow and represent concrete metric for platform usage.",
      },
      {
        question: "Do you offer discounts?",
        answer:
          "Yes, we provide discounts for multi-year agreements as well as to partners.",
      },
      {
        question: "Can you help me automate my operations?",
        answer:
          "Yes! We offer support with setup, configuration, automation and app creation.",
      },
      {
        question: "Can I rebrand (white-label) or resell Shuffle?",
        answer:
          "Yes of course, please fill out our partner form [here](https://shuffler.io/partners).",
      },
    ];

    return (
      <Box sx={{ mt: 14, maxWidth: "1200px", width: "100%", pb: 10 }}>
        <Typography
          variant="h4"
          align="center"
          sx={{
            color: "#ffffff",
            mb: 8,
            fontFamily: theme.typography.fontFamily,
            fontWeight: "bold",
            px: {
              xs: 6,
              md: 0,
            },
            lineHeight: {
              xs: 1.5,
              md: 1,
            },
          }}
        >
          Frequently Asked Questions
        </Typography>
        <Box
          sx={{
            display: "flex",
            width: "100%",
            flexDirection: {
              xs: "column",
              md: "row",
            },
            alignItems: "flex-start",
            gap: 4,
          }}
        >
          <Box
            sx={{
              backgroundColor: "#212121",
              py: 4,
              borderRadius: "16px",
              color: "#ffffff",
              ml: {
                xs: 0,
                md: 6,
              },
              minHeight: "300px",
              width: {
                xs: "100%",
                md: "40%",
              },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Typography
              variant="h5"
              sx={{ fontWeight: "bold", maxWidth: "200px", pl: 4 }}
            >
              Got other Questions?
            </Typography>
            <Box
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                paddingLeft: "-5px",
              }}
            >
              <Typography
                variant="body1"
                sx={{ paddingLeft: "5px", color: "#f1f1f1", pl: 4 }}
              >
                Here is how you can contact us:
              </Typography>
              <Button
                variant="text"
                component="a"
                disableRipple
                href="https://shuffler.io/contact?category=contact"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: "#ff8544",
                  textTransform: "none",
                  mt: 1,
                  display: "flex",
                  alignItems: "center",
                  fontFamily: theme.typography.fontFamily,
                  fontSize: {
                    xs: "14px",
                    md: "16px",
                  },
                  gap: "8px",
                  pl: 4,
                  "&:hover": {
                    backgroundColor: "transparent",
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  },
                }}
                onClick={() => {
                  if(isCloud){
                    ReactGA.event({
                      category: 'NewPricingPage',
                      action: 'FAQs Link Clicked',
                      label: 'Send us a message',
                    });
                  }
                }}
              >
                <MessageCircle size={18} strokeWidth={1.8} color="#ffffff" aria-label="chat" />
                Send us a message
              </Button>
              <Button
                variant="text"
                disableRipple
                component={Link}
                to="mailto:support@shuffler.io"
                sx={{
                  color: "#ff8544",
                  textTransform: "none",
                  display: "flex",
                  alignItems: "center",
                  fontFamily: theme.typography.fontFamily,
                  fontSize: {
                    xs: "14px",
                    md: "16px",
                  },
                  gap: "8px",
                  pl: 4,
                  "&:hover": {
                    backgroundColor: "transparent",
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  },
                }}
                onClick={() => {
                  if(isCloud){
                    ReactGA.event({
                      category: 'NewPricingPage',
                      action: 'FAQs Link Clicked',
                      label: 'Mail to support@shuffler.io',
                    });
                  }
                }}
              >
                <MailLucide size={18} strokeWidth={1.8} color="#ffffff" aria-label="mail" />
                support@shuffler.io
              </Button>

              <Button
                variant="text"
                disableRipple
                onClick={() => {
                  if(isCloud){
                    ReactGA.event({
                      category: 'NewPricingPage',
                      action: 'FAQs Link Clicked',
                      label: 'Join our Discord',
                    });
                  }
                  window.open("https://discord.gg/B2CBzUm", "_blank");
                }}
                sx={{
                  color: "#ff8544",
                  textTransform: "none",
                  display: "flex",
                  alignItems: "center",
                  fontFamily: theme.typography.fontFamily,
                  fontSize: {
                    xs: "14px",
                    md: "16px",
                  },
                  gap: "8px",
                  pl: 4,
                  "&:hover": {
                    backgroundColor: "transparent",
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  },
                }}
              >
                <MessagesSquare size={18} strokeWidth={1.8} color="#ffffff" aria-label="discord" />
                Join our Discord
              </Button>
            </Box>
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              width: {
                xs: "100%",
                md: "60%",
              },
              mr: 6,
              gap: 2,
              borderRadius: "16px",
            }}
          >
            {faqs.map((faq, index) => (
              <Accordion
                key={index}
                disableGutters
                elevation={0}
                expanded={expandedIndex === index}
                sx={{
                  fontFamily: theme.typography.fontFamily,
                  boxShadow: "none",
                  border: "none",
                  padding: "0",
                  margin: "0",
                  outline: "none",
                  backgroundColor: "#1A1A1A",
                  borderRadius: "16px",
                  "&::before": {
                    display: "none", // Removes the gray line
                    backgroundColor: "transparent",
                  },
                }}
                onClick={() => {
                  if(isCloud){
                    ReactGA.event({
                      category: 'NewPricingPage',
                      action: 'FAQ Clicked',
                      label: `${faq.question}`,
                    });
                  }
                }}
              >
                <AccordionSummary
                  expandIcon={expandedIndex === index ? <Minus size={18} color="#fff" /> : <Plus size={18} color="#fff" />}
                  aria-controls={`faq-content-${index}`}
                  id={`faq-header-${index}`}
                  onClick={() =>
                    setExpandedIndex(expandedIndex === index ? null : index)
                  }
                  sx={{
                    padding: "16px",
                    borderRadius: "16px",
                    backgroundColor: "#212121",
                    pl: 3,
                    boxShadow: "none",
                    outline: "none",
                    transition: "min-height 0.3s, border-radius 0.3s", // Smooth transition

                    "&.Mui-expanded": {
                      minHeight: "unset",
                      borderRadius: "16px 16px 0 0",
                      transition: "border-radius 0.1s ease-in-out", // Smooth transition
                    },
                  }}
                >
                  <Typography
                    sx={{
                      color: "#f1f1f1",
                      fontWeight: "bold",
                      fontSize: "16px",
                    }}
                  >
                    {faq.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails
                  sx={{
                    padding: "16px",
                    backgroundColor: "#212121",
                    borderRadius: "0 0 16px 16px",
                    transition: "background-color 0.3s, border-radius 0.3s",
                    mt: -2, // Smooth transition
                  }}
                >
                  <Typography
                    sx={{ color: "#f1f1f1", fontSize: "16px", pl: 1, pb: 1 }}
                  >
                    {!faq?.answer?.includes("](") ? faq?.answer : (
                      <>
                        {faq?.answer?.split("[")[0]}
                        <Button
                          variant="text"
                          component="a"
                          href={faq?.answer?.split("](")[1]?.split(")")[0]}
                          target="_blank"
                          sx={{
                            color: "#ff8544",
                            textTransform: "none",
                            fontFamily: theme.typography.fontFamily,
                            p: 0,
                            m: 0,
                            mx: -2,
                            "&:hover": {
                              backgroundColor: "transparent",
                              textDecoration: "underline",
                            },
                          }}
                        >
                          {faq?.answer?.split("[")[1]?.split("]")[0]}
                        </Button>
                      </>
                    )}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Box>
      </Box>
    );
  };

  const GetStartedSection = () => {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          backgroundColor: "#212121",
          py: {
            xs: 10,
            md: 16,
          },
          pt:{
            xs: 10,
            md: 8,
          },
          mt: 8,
          fontFamily: theme.typography.fontFamily,
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            width: "100%",
            maxWidth: "1200px",
            gap: {
              xs: 6,
              md: 0,
            },
            alignItems: {
              xs: "center",
              md: "flex-start",
            },
            justifyContent: {
              xs: "center",
              md: "flex-start",
            },
            flexDirection: {
              xs: "column",
              md: "row",
            },
            px: {
              xs: 2,
              md: 0,
            },
            fontFamily: theme.typography.fontFamily,
          }}
        >
          {/* Left Section */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: {
                xs: "center",
                md: "flex-start",
              },
              pl: {
                xs: 0,
                md: 6,
              },
              width: {
                xs: "100%",
                md: "50%",
              },
              fontFamily: theme.typography.fontFamily,
              mt: 2,
            }}
          >
            <Typography
              sx={{
                color: "#ffffff",
                mb: 2,
                fontSize: {
                  xs: "36px",
                  md: "40px",
                },
                fontWeight: "bold",
                fontFamily: theme.typography.fontFamily,
              }}
            >
              Get started for free
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#ffffff",
                mb: 3,
                fontSize: {
                  xs: "14px",
                  md: "16px",
                },
                fontFamily: theme.typography.fontFamily,
                maxWidth: {
                  xs: "100%",
                  md: "380px",
                  lg: "430px",
                },
                mt: {
                  xs: 2,
                  md: 0,
                },
                textAlign: {
                  xs: "center",
                  md: "left",
                },
              }}
            >
              Start for free with either of our plans. Upgrade to a free plan to
              unlock extra features that will elevate your security automation
              needs.
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexDirection: {
                  xs: "column",
                  md: "row",
                },
                gap: {
                  xs: 3,
                  md: 2,
                },
                width: {
                  xs: "90%",
                  md: "100%",
                },
                pt: 2,
              }}
            >
              <Button
                variant="outlined"
                disableRipple
                component={Link}
                to={"/register"}
                sx={{
                  color: "#ffffff",
                  textTransform: "none",
                  fontSize: {
                    xs: "14px",
                  },
                  px: 4,
                  py: {
                    xs: 1.5,
                    md: 1,
                  },
                  fontFamily: theme.typography.fontFamily,
                  backgroundColor: "transparent",
                  border: "1px solid #f1f1f1",
                  borderRadius: "8px",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    color: "#ffffff",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: "white",
                  },
                }}
                onClick={() => {
                  if(isCloud){
                    ReactGA.event({
                      category: 'NewPricingPage',
                      action: 'Prefooter Button Clicked',
                      label: 'Sign up for Free',
                    });
                  }
                }}
              >
                Sign up for Free
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  if(isCloud){
                    ReactGA.event({
                      category: 'NewPricingPage',
                      action: 'Prefooter Button Clicked',
                      label: 'Select a Plan',
                    });
                  }
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }}
                sx={{
                  background: "linear-gradient(90deg, #FF8544, #FB47A0)",
                  color: "#ffffff",
                  textTransform: "none",
                  fontSize: {
                    xs: "14px",
                  },
                  borderRadius: "8px",
                  px: {
                    xs: 4,
                    md: 6,
                  },
                  py: {
                    xs: 1.5,
                    md: 1,
                  },
                  fontFamily: theme.typography.fontFamily,
                  position: "relative",
                  isolation: "isolate",
                  color: "white",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    background: "#FE804B",
                    borderRadius: "8px",
                    opacity: 0,
                    transition: "opacity 0.3s ease",
                    zIndex: -1,
                  },
                  "&:hover::before": {
                    opacity: 1,
                  },
                }}
              >
                Select a Plan
              </Button>
            </Box>
          </Box>

          {/* Right Section */}
          <Box
            sx={{
              width: {
                xs: "100%",
                md: "50%",
              },
              backgroundColor: "transparent",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              flexDirection: "column",
              pl: {
                xs: 6,
                md: 0,
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "space-between",
                py: {
                  xs: "30px",
                  sm: "40px",
                },
                px: {
                  xs: "20px",
                  sm: "25px",
                },
                gap: "40px",
                mt:4,
                mr: 4,
                borderRadius: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                }}
              >
                <img
                  src="/images/review.svg"
                  alt="Customer Review"
                  style={{ marginRight: "15px" }}
                />
                <Typography
                  variant="body1"
                  sx={{
                    color: "#F1F1F1",
                    mb: 1,
                    fontFamily: theme?.typography?.fontFamily,
                    fontSize: {
                      xs: "14px",
                      md: "16px",
                    },
                    "&::selection": {
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "#FB47A0",
                    },
                    "&::-moz-selection": {
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "#FB47A0",
                    },
                  }}
                >
                  "Shuffle's user-friendly automation workflows have
                  significantly streamlined our security operations, allowing us
                  to quickly detect and respond to threats."
                </Typography>
              </div>
              <img
                src="/images/companies_logo/nio_white.svg"
                alt="NIO"
                style={{ marginBottom: "-10px", width: "80px" }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  const stripe =
    typeof window === "undefined" || window.location === undefined
      ? ""
      : stripeKey === undefined
      ? ""
      : window.Stripe
      ? window.Stripe(stripeKey)
      : "";

  const isLoggedInHandler = () => {
    var priceItem;
    if (window.location.origin === "https://shuffler.io" || window.location.origin === "https://sandbox.shuffler.io") {
      priceItem = billingCycle === "monthly" ? "price_1R66rbEJjT17t98NHIQ78nrz" : "price_1R671UEJjT17t98NzfqWvSG7"
    } else if (window.location.origin === "http://localhost:3002") {
      priceItem = billingCycle === "monthly" ? "price_1R678hEJjT17t98Nai5J50gs" : "price_1R6c84EJjT17t98NR68gUfT7"
  }

    const successUrl = `${window.location.origin}/admin?admin_tab=billingstats&payment=success`;
    const failUrl = `${window.location.origin}/pricing?admin_tab=billingstats&payment=failure`;

    let quantity;

    if (billingCycle === "monthly") {
      quantity = scaleValue / 10
    } else {
      quantity = (scaleValue / 10) * 12
    }

    redirectToCheckout(priceItem, quantity, successUrl, failUrl);
  };

  const redirectToCheckout = (priceItem, quantity, successUrl, failUrl) => {
    const checkoutObject = {
      lineItems: [
        {
          price: priceItem,
          quantity: quantity,
        },
      ],
      mode: "subscription",
      billingAddressCollection: "auto",
      successUrl: successUrl,
      cancelUrl: failUrl,
      clientReferenceId: userdata.active_org.id,
    };

    console.log("OBJECT: ", priceItem, checkoutObject);

    stripe
      .redirectToCheckout(checkoutObject)
      .then(function (result) {
        console.log("SUCCESS STRIPE?: ", result);

        ReactGA.event({
          category: "pricing",
          action: "add_card_success",
          label: "",
        });
      })
      .catch(function (error) {
        console.error("STRIPE ERROR: ", error);

        ReactGA.event({
          category: "pricing",
          action: "add_card_error",
          label: "",
        });
      });
  };

  return (
    <Box
      sx={{
        fontFamily: theme.typography.fontFamily,
        width: "100%",
        overflow: {
          xs: "hidden",
          lg: "visible",
        },
      }}
    >
      <Box
        sx={{
          padding: { xs: 2, md: 3 },
          minHeight: "100vh",
          maxWidth: "1200px",
          paddingTop: {
            xs: "15px",
            md: "25px",
            lg: "35px",
          },
          mx: "auto",
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: {
              xs: 60,
              md: 80,
            },
            left: {
              xs: -20,
              sm: 50,
              md: 110,
            },
            height: {
              xs: 300,
              md: 500,
            },
            width: {
              xs: 600,
              sm: 800,
              md: 1050,
            },
            rotate: "180deg",
            filter: "blur(100px)",
            zIndex: 0,
            opacity: 0.8,
          }}
        >
          <img
            src="/images/logos/orange-pink.png"
            style={{
              width: "100%",
              height: "100%",
            }}
          />
        </Box>
        <Typography
          component="h1"
          align="center"
          gutterBottom
          sx={{
            fontWeight: "bold",
            fontSize: {
              xs: "32px",
              md: "44px",
              lg: "50px",
            },
            mb: {
              xs: 4,
              lg: 2,
            },
            color: "#ffffff",
            fontFamily: theme.typography.fontFamily,
          }}
        >
          Pricing Plans
        </Typography>

        <Box sx={{ display: "flex", justifyContent: "center", mb: 4, mt: 3 }}>
          <ToggleButtonGroup
            value={selectedPlan}
            exclusive
            onChange={handlePlanChange}
            aria-label="plan"
            sx={{
              backgroundColor: "transparent",
              fontFamily: theme.typography.fontFamily,
              border: "1.5px solid #ff8544",
              borderRadius: "8px",
              padding: "3px",
              display: {
                xs: "flex",
                lg: "none",
              },
              width: "90%", // Add this to make container full width
              "& .MuiToggleButton-root": {
                flex: 1, // Add this to make buttons equal width
                width: "30%",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                padding: "10px 30px",
                textTransform: "none",
                fontSize: {
                  xs: "12px",
                  sm: "14px",
                },
                "&.Mui-selected": {
                  backgroundColor: "#ff8544",
                  fontFamily: theme.typography.fontFamily,
                  color: "#1A1A1A",
                  fontWeight: "bold",
                  "&:hover": {
                    backgroundColor: "#ff8544",
                  },
                },
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                },
              },
            }}
          >
            {selectedDeployment === "Self-Hosted" ? (
              <>
                <ToggleButton value="open source" aria-label="open source">
                  Open Source
                </ToggleButton>
                <ToggleButton value="enterprise" aria-label="enterprise">
                  Enterprise
                </ToggleButton>
              </>
            ) : (
              <>
                <ToggleButton value="scale" aria-label="starter">
                  Starter
                </ToggleButton>
                <ToggleButton value="standard" aria-label="standard">
                  Standard
                </ToggleButton>
                <ToggleButton value="enterprise" aria-label="enterprise">
                  Enterprise
                </ToggleButton>
              </>
            )}
          </ToggleButtonGroup>
        </Box>

        {/* Deployment toggle */}
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <ToggleButtonGroup
            value={selectedDeployment}
            exclusive
            onChange={(event, newValue) => {
              if (newValue !== null) {
                setSelectedDeployment(newValue);
                // Update selected plan based on deployment
                if (newValue === "Self-Hosted") {
                  setSelectedPlan("open source");
                } else {
                  setSelectedPlan("scale");
                }
                if(isCloud){
                  ReactGA.event({
                    category: 'NewPricingPage',
                    action: 'Deployment Changed',
                    label: `${selectedDeployment} -> ${newValue}`,
                  });
                }
                // Add deployment to URL query params
                const urlSearchParams = new URLSearchParams(window.location.search);
                urlSearchParams.set("env", newValue);
                const newUrl = `${window.location.pathname}?${urlSearchParams.toString()}`;
                window.history.replaceState({}, "", newUrl);
              }
            }}
            aria-label="deployment"
            sx={{
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              fontFamily: theme.typography.fontFamily,
              borderRadius: "30px",
              padding: "3px",
              "& .MuiToggleButton-root": {
                border: "none",
                borderRadius: "30px",
                color: "#fff",
                padding: {
                  xs: "8px 16px",
                  sm: "8px 20px",
                },
                textTransform: "none",
                fontSize: {
                  xs: "12px",
                  sm: "14px",
                  lg: "16px",
                },
                display: "flex",
                alignItems: "center",
                gap: {
                  xs: "6px",
                  sm: "8px",
                },
                fontFamily: theme.typography.fontFamily,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                "&.Mui-selected": {
                  backgroundColor: "#fff",
                  fontFamily: theme.typography.fontFamily,
                  color: "#1A1A1A",
                  fontWeight: "bold",
                  transform: "scale(1.05)",
                  "&:hover": {
                    backgroundColor: "#fff",
                  },
                },
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  transform: "scale(1.02)",
                },
              },
            }}
          >
            <ToggleButton value="Cloud" aria-label="cloud">
              <CloudIcon selected={selectedDeployment === "Cloud"} />
              Cloud
            </ToggleButton>
            <ToggleButton value="Self-Hosted" aria-label="self-hosted">
              <SelfHostedIcon selected={selectedDeployment === "Self-Hosted"} />
              Self-Hosted
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Pricing cards */}
        <Grid
          container
          spacing={{
            xs: 3,
            md: selectedDeployment === "Self-Hosted" ? 6 : 4
          }}
          justifyContent="center"
          sx={{
            mt: {
              xs: selectedDeployment === "Self-Hosted" ? 0.5 : 1,
              sm: selectedDeployment === "Self-Hosted" ? 0.5 : 2,
            },
            transition: "all 0.5s ease-in-out",
          }}
        >
          {getFilteredPlans().map((plan, index) => (
            <Grid
              size={{
                xs: 12,
                sm: 12,
                md: selectedDeployment === "Self-Hosted" ? 6 : 4,
                lg: selectedDeployment === "Self-Hosted" ? 5 : 4,
              }}
              key={index}
              sx={{
                maxWidth: {
                  xs: "500px",
                  md: selectedDeployment === "Self-Hosted" ? "590px" : "100%",
                  lg: "100%",
                },
              }}
            >

              <Box
                sx={{
                  position: "relative",
                  height: "100%",
                  display: {
                    xs:
                      selectedPlan.toLowerCase() === plan.type.toLowerCase()
                        ? "block"
                        : "none",
                    md: "block",
                  },
                  marginTop: {
                    xs:
                      selectedDeployment === "Self-Hosted" &&
                      plan.type.toLowerCase() === "enterprise"
                        ? 3
                        : 0,
                    md: 0,
                  },

                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  animation: "fadeIn 0.6s ease-in-out",
                  "@keyframes fadeIn": {
                    from: { opacity: 0 },
                    to: { opacity: 1 },
                  },
                }}
              >
                {plan.isRecommended && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: -35,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 0,
                      background:
                        "linear-gradient(90deg, #FF8544 0%, #FB47A0 100%)",
                      pt: 1,
                      pb: 3,
                      borderRadius: "16px 16px 0 0",
                      width: "98.6%",
                    }}
                  >
                    <Typography
                      align="start"
                      sx={{
                        fontWeight: "bold",
                        fontSize: 14,
                        color: "#ffffff",
                        pl: 2,
                      }}
                    >
                      Recommended
                    </Typography>
                  </Box>
                )}
                <Card
                  sx={{
                    ...(plan.isRecommended ? recommendedCardStyle : cardStyle),
                    height: {
                      xs: "fit-content",
                      sm: "100%",
                    },
                    marginTop: {
                      xs: plan.type.toLowerCase() === "enterprise" ? -8 : 0,
                      lg: 5,
                    },
                  }}
                  elevation={0}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: {
                          xs: "flex-start",
                          md: "center",
                        },
                        flexDirection: {
                          xs: plan.deploymentOptions ? "column" : "row",
                          md: "row",
                        },
                        gap: {
                          xs: 3,
                          md: 0,
                        },
                        justifyContent: "space-between",
                        mb: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                        }}
                      >
                        <Typography
                          variant="h5"
                          component="div"
                          sx={{
                            fontWeight: "bold",
                            color: "#ffffff",
                            fontFamily: theme.typography.fontFamily,
                          }}
                        >
                          {plan.displayType || plan.type}
                        </Typography>
                      </Box>

                      {plan.type.toLowerCase() === "scale" && (
                        <ToggleButtonGroup
                          value={billingCycle}
                          exclusive
                          onChange={handleBillingCycleChange}
                          aria-label="billing cycle"
                          sx={{
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                            fontFamily: theme.typography.fontFamily,
                            borderRadius: "30px",
                            padding: "3px",
                            "& .MuiToggleButton-root": {
                              border: "none",
                              borderRadius: "30px",
                              color: "#fff",
                              padding: {
                                xs: "4px 8px",
                                sm: "4px 12px",
                              },
                              textTransform: "none",
                              fontSize: "12px",
                              fontFamily: theme.typography.fontFamily,
                              transition: "all 0.2s ease-in-out",
                              "&.Mui-selected": {
                                backgroundColor: "#fff",
                                fontFamily: theme.typography.fontFamily,
                                color: "#1A1A1A",
                                fontWeight: "bold",
                                "&:hover": {
                                  backgroundColor: "#fff",
                                },
                              },
                              "&:hover:not(.Mui-selected)": {
                                backgroundColor: "rgba(255, 255, 255, 0.2)",
                              },
                            },
                          }}
                        >
                          <ToggleButton value="monthly" aria-label="monthly">
                            Monthly
                          </ToggleButton>
                          <ToggleButton value="annual" aria-label="annual">
                            Yearly (10% off)
                          </ToggleButton>
                        </ToggleButtonGroup>
                      )}

                      {/* {plan.deploymentOptions && (
                        <ToggleButtonGroup
                          value={selectedDeployment}
                          exclusive
                          size="small"
                          onChange={(event, newValue) => {
                            if (newValue) {
                              setSelectedDeployment(newValue);
                              if (isCloud) {
                                ReactGA.event({
                                  category: "NewPricingPage",
                                  action:
                                    "Deployment Type Changed on Features table",
                                  label: `${selectedDeployment} -> ${newValue}`,
                                });
                              }
                              window.history.pushState(
                                {},
                                "",
                                window.location.pathname + "?env=" + newValue
                              );
                            }
                          }}
                          sx={{
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                            borderRadius: "30px",
                            padding: "2px",
                            "& .MuiToggleButton-root": {
                              border: "none",
                              borderRadius: "30px",
                              color: "#fff",
                              padding: "6px 14px",
                              textTransform: "none",
                              fontSize: "12px",
                              "&.Mui-selected": {
                                backgroundColor: "#fff",
                                color: "#222",
                                fontWeight: "bold",
                                "&:hover": {
                                  backgroundColor: "#fff",
                                },
                              },
                              "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.2)",
                              },
                            },
                          }}
                        >
                          {plan.deploymentOptions.map((option, idx) => (
                            <Tooltip
                              title={option === "Cloud" ? "Shuffle Cloud" : "Self-hosted"}
                              placement="top"
                              arrow
                              componentsProps={{
                                tooltip: {
                                  sx: {
                                    backgroundColor: "rgba(33, 33, 33, 1)",
                                    color: "#f1f1f1",
                                    fontSize: 14,
                                    border: "1px solid rgba(73, 73, 73, 1)",
                                    fontFamily: theme?.typography?.fontFamily,
                                    cursor: "default",
                                  },
                                },
                              }}
                            >
                              <ToggleButton key={idx} value={option}>
                                {option === "Cloud" ? (
                                  <CloudIcon
                                    selected={selectedDeployment === option}
                                  />
                                ) : (
                                  <SelfHostedIcon
                                    selected={selectedDeployment === option}
                                  />
                                )}
                              </ToggleButton>
                            </Tooltip>
                          ))}
                        </ToggleButtonGroup>
                      )} */}
                    </Box>

                    <Typography
                      color="#c5c5c5"
                      sx={{
                        mb:
                          plan.type.toLowerCase() === "scale" ||
                          plan.type.toLowerCase() === "enterprise"
                            ? 2
                            : 4,
                        mt: 2,
                        fontSize: "14px",
                      }}
                    >
                      {plan.subtitle.split("\n").map((text, i) => (
                        <React.Fragment key={i}>
                          {text}
                          {i < plan.subtitle.split("\n").length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </Typography>

                    {plan.type === "Scale" && (
                      <Box sx={{ mt: 2, px: 1 }}>
                        <Slider
                          value={scaleValue}
                          onChange={handleScaleChange}
                          aria-labelledby="scale-slider"
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}k`}
                          step={10}
                          min={10}
                          max={300}
                          marks
                          sx={{
                            color: "#ff8544",
                            "& .MuiSlider-thumb": {
                              width: 15,
                              height: 15,
                            },
                            "& .MuiSlider-valueLabel": {
                              backgroundColor: "rgba(33, 33, 33, 1)",
                              color: "rgba(241, 241, 241, 1)",
                              fontSize: 14,
                              borderRadius: "4px",
                              border: "1px solid rgba(73, 73, 73, 1)",
                              fontFamily: theme?.typography?.fontFamily,
                            },
                          }}
                        />
                      </Box>
                    )}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        mb: 2,
                        fontSize: "40px",
                      }}
                    >
                      <Typography
                        component="div"
                        sx={{
                          fontWeight: "bold",
                          mb: 1,
                          fontSize: "40px",
                          display: "flex",
                          flexDirection: "column",
                          lineHeight: 1.1,
                          pt:
                            plan.type.toLowerCase() === "enterprise"
                              ? (selectedDeployment === "Cloud" ? 0.6 : 4.5)
                              : plan.type.toLowerCase() === "scale"
                              ? 0
                              : plan.type.toLowerCase() === "open source"
                              ? 4.5
                              : plan.type.toLowerCase() === "standard"
                              ? 0.6
                              : 2.2,
                        }}
                      >
                        {(plan.type === "Standard" ||
                          (plan.type === "Enterprise" && selectedDeployment === "Cloud")) && (
                          <span style={{ fontSize: "12px", fontWeight: 500, color: "#c5c5c5", letterSpacing: "0.3px" }}>
                            Starts from
                          </span>
                        )}
                        <span>
                          {plan.type === "Scale"
                            ? `$${getPrice(32) * (scaleValue / 10)}`
                            : plan.title}
                        </span>
                      </Typography>

                      {plan.type === "Scale" && (
                        <Typography
                          sx={{ mb: "-2px", fontSize: "14px" }}
                          color="#c5c5c5"
                        >
                          /month for {scaleValue}k App Runs
                        </Typography>
                      )}

                      {(plan.type === "Standard" ||
                        (plan.type === "Enterprise" && selectedDeployment === "Cloud")) && (
                        <Typography
                          sx={{ mb: "-2px", fontSize: "14px", pt: 2.2 }}
                          color="#c5c5c5"
                        >
                          /month
                        </Typography>
                      )}
                    </div>

                    {plan.type === "Scale" ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2, mb: 1.5 }}>
                        <Button
                          variant="outlined"
                          fullWidth
                          disableRipple
                          onClick={plan.buttonAction}
                          sx={{
                            py: 1.2,
                            borderRadius: "8px",
                            textTransform: "none",
                            fontSize: { xs: "12px", sm: "14px" },
                            color: "#ffffff",
                            border: "1.5px solid #ff8544",
                            background: isLoggedIn ? "rgba(255, 255, 255, 0.05)" : "transparent",
                            boxShadow: "none",
                            "&:hover": {
                              background: "rgba(255, 133, 68, 0.1)",
                              borderColor: "#ff8544",
                              boxShadow: "none",
                            },
                            cursor: isLoggedIn ? "default" : "pointer",
                          }}
                        >
                          {plan.buttonText}
                        </Button>
                        <Button
                          variant="contained"
                          fullWidth
                          disableRipple
                          onClick={plan.secondaryButtonAction}
                          sx={{
                            py: 1.2,
                            borderRadius: "8px",
                            textTransform: "none",
                            fontSize: { xs: "12px", sm: "14px" },
                            color: "#1A1A1A",
                            background: "#FF8544",
                            boxShadow: "none",
                            "&:hover": { background: "#FF955C", boxShadow: "none" },
                          }}
                        >
                          {plan.secondaryButtonText}
                        </Button>
                      </Box>
                    ) : (
                    <Button
                      variant="contained"
                      fullWidth
                      disableRipple
                      onClick={plan.buttonAction}
                      sx={{
                        mt: 2,
                        mb: 1.5,
                        py: 1.2,
                        borderRadius: "8px",
                        textTransform: "none",
                        fontSize: {
                          xs: "12px",
                          sm: "14px",
                        },
                        color:
                          plan.type.toLowerCase() === "starter"
                            ? "#ffffff"
                            : "#1A1A1A",
                        border: "1.5px solid",
                        borderColor:
                          plan.type.toLowerCase() === "enterprise"
                            ? "transparent"
                            : plan.type.toLowerCase() === "scale" || plan.type.toLowerCase() === "open source"
                            ? "transparent"
                            : isLoggedIn
                            ? "#c5c5c5"
                            : "#ff8544",
                        background:
                          plan.type.toLowerCase() === "enterprise"
                            ? "#2BC07E"
                            : plan.type.toLowerCase() === "scale" || plan.type.toLowerCase() === "open source"
                            ? "#FF8544"
                            : isLoggedIn
                            ? "rgba(255, 255, 255, 0.1)"
                            : "transparent",
                        boxShadow: "none",
                        "&:hover": {
                          background:
                            plan.type.toLowerCase() === "enterprise"
                              ? "#3FDF98"
                              : plan.type.toLowerCase() === "scale" || plan.type.toLowerCase() === "open source"
                              ? "#FF955C"
                              : isLoggedIn
                              ? "rgba(255, 255, 255, 0.1)"
                              : "rgba(255, 133, 68, 0.1)",
                          borderColor:
                            plan.type.toLowerCase() === "enterprise"
                              ? "#3FDF98"
                              : plan.type.toLowerCase() === "scale" || plan.type.toLowerCase() === "open source"
                              ? "transparent"
                              : isLoggedIn
                              ? "#c5c5c5"
                              : "#ff8544",
                          boxShadow: "none",
                          color:
                            plan.type.toLowerCase() === "starter"
                              ? "#ffffff"
                              : "#1A1A1A",
                        },
                        cursor:
                          plan.type.toLowerCase() === "starter" && isLoggedIn
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {plan.buttonText}
                    </Button>
                    )}

                    <Divider sx={{ my: 1.5 }} />

                    {/* For Enterprise plan, show deployment type indicator */}
                    {/* {plan.deploymentOptions && (
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 2 }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ display: "flex", alignItems: "center" }}
                        >
                          <img
                            src={
                              selectedDeployment === "Cloud"
                                ? "/icons/cloudIcon.svg"
                                : "/icons/onPrem.svg"
                            }
                            style={{
                              marginRight: "10px",
                              width: "18px",
                              height: "18px",
                            }}
                            alt="cloud"
                          />
                          {selectedDeployment === "Cloud"
                            ? "Shuffle Cloud"
                            : "Self-hosted"}
                        </Typography>
                      </Box>
                    )} */}
                    {/* {plan.deploymentOptions && (
                        <ToggleButtonGroup
                          value={selectedDeployment}
                          exclusive
                          size="small"
                          onChange={(event, newValue) => {
                            if (newValue) {
                              setSelectedDeployment(newValue);

                              if(isCloud){
                                ReactGA.event({
                                  category: 'NewPricingPage',
                                  action: 'Deployment Type Changed',
                                  label: `${selectedDeployment} -> ${newValue}`,
                                });
                              }
                              // Add environment to URL query params
                              const urlSearchParams = new URLSearchParams(
                                window.location.search
                              );
                              urlSearchParams.set("env", newValue);
                              const newUrl = `${
                                window.location.pathname
                              }?${urlSearchParams.toString()}`;
                              window.history.replaceState({}, "", newUrl);
                            }
                          }}
                          sx={{
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                            borderRadius: "30px",
                            marginBottom: "12px",
                            padding: "2px",
                            "& .MuiToggleButton-root": {
                              border: "none",
                              borderRadius: "30px",
                              color: "#fff",
                              padding: "4px 13px",
                              textTransform: "none",
                              fontSize: "12px",
                              "&.Mui-selected": {
                                backgroundColor: "#fff",
                                color: "#222",
                                fontWeight: "600",
                                "&:hover": {
                                  backgroundColor: "#fff",
                                },
                              },
                              "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.2)",
                              },
                            },
                          }}
                        >
                          {plan.deploymentOptions.map((option, idx) => (
                            <ToggleButton key={idx} value={option}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {option === "Cloud" 
                                  ? <CloudIcon selected={selectedDeployment === option} />
                                  : <SelfHostedIcon selected={selectedDeployment === option} />
                                }
                                {option === "Cloud" ? "Shuffle Cloud" : "Self-hosted"}
                              </Box>
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                      )} */}

                    {/* Cloud indicator - Only show for plans without deployment options */}
                    {/* {!plan.deploymentOptions && (
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 2 }}
                      >
                        <Typography
                          sx={{ display: "flex", alignItems: "center", fontWeight: "500", fontSize: "14px"}}
                        >
                          <img
                            src="/icons/cloudIcon.svg"
                            style={{
                              marginRight: "10px",
                              width: "18px",
                              height: "18px",
                            }}
                            alt="cloud"
                          />
                          Shuffle Cloud
                        </Typography>
                      </Box>
                    )} */}
                    {/* Additional text */}
                    {plan.additionalText && (
                      <Typography
                        color="#c5c5c5"
                        sx={{ fontSize: "14px", marginTop: 1 }}
                      >
                        {plan.additionalText}
                      </Typography>
                    )}
                    {/* Exclusive features */}
                    <Box
                      sx={{
                        backgroundColor: "transparent",
                        p: 2,
                        mt: 1.5,
                        borderRadius: "8px",
                        border: "1px solid #494949",
                        mb: 1.5,
                      }}
                    >
                      {/* <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: "bold",
                          mb: 1,
                          color:
                            plan.type.toLowerCase() === "enterprise"
                              ? "#2BC07E"
                              : plan.type.toLowerCase() === "scale"
                              ? "#FF8544"
                              : "#C5C5C5",
                        }}
                      >
                        {plan.exclusive.title}
                      </Typography> */}
                      {plan.exclusive.features.map((feature, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            fontSize: "14px",
                            mb:
                              idx < plan.exclusive.features.length - 1 ? 1 : 0,
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: "13px",
                              flexGrow: 1,
                            }}
                          >
                            {feature.text.replace("10k", `${scaleValue}k`)}
                          </Typography>
                          {typeof feature === "object" && feature.tooltip && (
                            <Tooltip
                              title={
                                <ReactMarkdown
                                  components={{
                                    a: ({ node, ...props }) => (
                                      <a
                                        style={{ color: "#FF8544" }}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        {...props}
                                      />
                                    ),
                                  }}
                                >
                                  {feature.tooltip}
                                </ReactMarkdown>
                              }
                              placement="top"
                              arrow
                              componentsProps={{
                                tooltip: {
                                  sx: {
                                    backgroundColor: "rgba(33, 33, 33, 1)",
                                    color: "#f1f1f1",
                                    fontSize: 13,
                                    paddingLeft: 2,
                                    border: "1px solid rgba(73, 73, 73, 1)",
                                    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.4)",
                                    fontFamily: theme?.typography?.fontFamily,
                                    cursor: "default",
                                  },
                                },
                              }}
                            >
                              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", ml: 1, color: "#888", cursor: "help", "&:hover": { color: "#fff" } }}>
                                <Info size={16} />
                              </Box>

                            </Tooltip>
                          )}
                        </Box>
                      ))}
                    </Box>

                    {/* Conditional rendering of features based on selected deployment */}
                    <Box>
                      {plan.type.toLowerCase() === "enterprise"
                        ? selectedDeployment === "Cloud"
                          ? plan.features.Cloud.map((feature, idx) => (
                              <Box key={idx} sx={itemStyle}>
                                {checkIcon}
                                <Typography
                                  sx={{ fontSize: "14px", marginLeft: "13px" }}
                                >
                                  {feature}
                                </Typography>
                              </Box>
                            ))
                          : plan.features.SelfHosted.map((feature, idx) => (
                              <Box key={idx} sx={itemStyle}>
                                {checkIcon}
                                <Typography
                                  sx={{ fontSize: "14px", marginLeft: "13px" }}
                                >
                                  {feature}
                                </Typography>
                              </Box>
                            ))
                        : plan.features.map((feature, idx) => (
                            <Box key={idx} sx={itemStyle}>
                              {checkIcon}
                              <Typography
                                sx={{ fontSize: "14px", marginLeft: "13px" }}
                              >
                                {feature}
                              </Typography>
                            </Box>
                          ))}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Additional sections */}
        <Grid container spacing={2} sx={{ mt: 8 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                backgroundColor: "#212121",
                p: 4,
                color: "#ffffff",
                borderRadius: "12px",
                marginRight: "5px",
              }}
            >
              <Typography
                variant="h5"
                component="div"
                sx={{
                  mb: 2,
                  fontWeight: "bold",
                  fontFamily: theme.typography.fontFamily,
                }}
              >
                Why Shuffle's pricing works
              </Typography>
              <Typography sx={{ mb: 4, color: "#c5c5c5", fontSize: "14px" }}>
                Understand why Shuffle is the most flexible and cost-effective
                option.
              </Typography>
              {/* <Button
                disableRipple
                component={Link}
                target="_blank"
                to="/articles/Why_Shuffle_Pricing_Works"
                onClick={() => {
                  if(isCloud){
                    ReactGA.event({
                      category: 'NewPricingPage',
                      action: 'Why Shuffle pricing works card',
                      label: 'Clicked Learn more',
                    });
                  }
                }}
                endIcon={<span>→</span>}
                sx={{
                  color: "#ff8544",
                  textTransform: "none",
                  p: 0,
                  "&:hover": {
                    backgroundColor: "transparent",
                  },
                }}
              >
                Learn more
              </Button> */}
              <Button
                disableRipple
                component="a"
                target="_blank"
                rel="noopener noreferrer"
                href="https://shuffler.io/articles/Shuffle_Pricing#why-shuffle-pricing-works"
                onClick={() => {
                  if (isCloud) {
                    ReactGA.event({
                      category: "NewPricingPage",
                      action: "Why Shuffle pricing works card",
                      label: "Clicked Learn more",
                    });
                  }
                }}
                sx={{
                  color: "#ff8544",
                  fontSize: { xs: "15px", md: "16px" },
                  p: 0,
                  mt: { xs: 2, md: 0 },
                  minWidth: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  "&:hover": {
                    backgroundColor: "transparent",
                  },
                  "&:hover .button-text": {
                    textDecoration: "underline",
                    textUnderlineOffset: "4px",
                  },
                  "&:hover .arrow-icon": {
                    transform: "translateX(4px)",
                  },
                  "& .arrow-icon": {
                    transition: "transform 0.2s ease",
                  },
                }}
              >
                <Typography
                  className="button-text"
                  sx={{
                    fontFamily: theme.typography.fontFamily,
                    fontSize: { xs: "14px" },
                    fontWeight: 500,
                    textTransform: "none",
                    color: "#ff8544",
                  }}
                >
                  Learn more
                </Typography>
                <span className="arrow-icon">→</span>
              </Button>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                backgroundColor: "#212121",
                p: 4,
                color: "#ffffff",
                borderRadius: "12px",
                marginLeft: "5px",
              }}
            >
              <Typography
                variant="h5"
                component="div"
                sx={{
                  mb: 2,
                  fontWeight: "bold",
                  fontFamily: theme.typography.fontFamily,
                }}
              >
                Shuffle 🧡 Open Source
              </Typography>
              <Typography sx={{ mb: 4, color: "#c5c5c5", fontSize: "14px" }}>
                Recommended for experts interested in Shuffle Enterprise.
              </Typography>
              <Button
                disableRipple
                component="a"
                target="_blank"
                rel="noopener noreferrer"
                href="https://shuffler.io/articles/Shuffle_Open_Source"
                onClick={() => {
                  if (isCloud) {
                    ReactGA.event({
                      category: "NewPricingPage",
                      action: "Open source plan card",
                      label: "Clicked Read more",
                    });
                  }
                }}
                sx={{
                  color: "#ff8544",
                  fontSize: { xs: "15px", md: "16px" },
                  p: 0,
                  mt: { xs: 2, md: 0 },
                  minWidth: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  "&:hover": {
                    backgroundColor: "transparent",
                  },
                  "&:hover .button-text": {
                    textDecoration: "underline",
                    textUnderlineOffset: "4px",
                  },
                  "&:hover .arrow-icon": {
                    transform: "translateX(4px)",
                  },
                  "& .arrow-icon": {
                    transition: "transform 0.2s ease",
                  },
                }}
              >
                <Typography
                  className="button-text"
                  sx={{
                    fontFamily: theme.typography.fontFamily,
                    fontSize: { xs: "14px" },
                    fontWeight: 500,
                    textTransform: "none",
                    color: "#ff8544",
                  }}
                >
                  Read more
                </Typography>
                <span className="arrow-icon">→</span>
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Bottom banner : Scroll to comparison table */}
        <Box
          sx={{
            backgroundColor: "#212121",
            p: 4,
            borderRadius: "12px",
            color: "#ffffff",
            mt: 3.5,
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            gap: 2,
          }}
        >
          <Typography
            variant="h6"
            component="div"
            sx={{ fontWeight: "bold", fontFamily: theme.typography.fontFamily }}
          >
            Compare plans below by features.
          </Typography>
          <Button
            disableRipple
            onClick={() => {
              const whatsIncludedElement =
                document.getElementById("whats-included");
              if (whatsIncludedElement) {
                whatsIncludedElement.scrollIntoView({ behavior: "smooth" });
              }
              if (isCloud) {
                ReactGA.event({
                  category: "NewPricingPage",
                  action: "Scroll to comparison table",
                  label: "Take me to the comparison table",
                });
              }
            }}
            sx={{
              color: "#ff8544",
              fontSize: { xs: "15px", md: "16px" },
              p: 0,
              mt: { xs: 2, md: 0 },
              minWidth: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              "&:hover": {
                backgroundColor: "transparent",
              },
              "&:hover .button-text": {
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              },
              "&:hover .arrow-icon": {
                transform: "translateX(4px)",
              },
              "& .arrow-icon": {
                transition: "transform 0.2s ease",
              },
            }}
          >
            <Typography
              className="button-text"
              sx={{
                fontFamily: theme.typography.fontFamily,
                fontSize: { xs: "14px" },
                fontWeight: 500,
                textTransform: "none",
                color: "#ff8544",
              }}
            >
              Compare Now
            </Typography>
            <span className="arrow-icon">→</span>
          </Button>
        </Box>

        {/* Footer note */}
        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          sx={{
            display: "block",
            width: "100%",
            mx: "auto",
            mt: 4,
            mb: 2,
            fontFamily: theme.typography.fontFamily,
            fontSize: {
              xs: "14px",
            },
          }}
        >
          Listed prices are in USD excluding taxes such as VAT and buying
          implies agreement to Shuffle's Terms and Conditions.
        </Typography>

        <Box
          sx={{
            mt: 8,
            position: "relative",
            display: {
              xs: "none",
              lg: "block",
            },
          }}
        >
          <img
            id="blur-image"
            src="/images/logos/orange-pink.png"
            style={{
              position: "absolute",
              top: 75,
              left: -220,
              height: 500,
              width: 550,
              rotate: "-90deg",
              filter: "blur(120px)",
              zIndex: 0,
              opacity: 0.8,
            }}
          />
          <Typography
            component="h2"
            align="center"
            id="whats-included"
            gutterBottom
            sx={{
              fontWeight: "bold",
              mb: 8,
              mt: 13,
              color: "#ffffff",
              fontSize: "35px",
              fontFamily: theme.typography.fontFamily,
            }}
          >
            What's Included?
          </Typography>
          <Box
            id="core-features"
            sx={{
              position: "sticky",
              top: {
                lg: 60,
                xl: 70,
              },
              paddingTop: 20,
              zIndex: 5,
              marginLeft: -1.5,
              backgroundColor: "transparent",
              transition: "background-color 0.3s ease, box-shadow 0.3s ease",
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              width: "100%",
              padding: 2,
            }}
          >
            <Typography
              sx={{
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: "bold",
                width: "20%",
              }}
            >
              {currentFeatureTitle}
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 2,
                width: "80%",
                height: "100%",
              }}
            >
              {getFilteredPlans().map((plan, idx) => (
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 2,
                    p: 3,
                    backgroundColor: "#212121",
                    borderRadius: "16px",
                    height: "100%",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <Typography
                      component="div"
                      sx={{
                        color: "#ffffff",
                        fontSize: "14px",
                        fontFamily: theme.typography.fontFamily,
                      }}
                    >
                      {plan.type.toLowerCase() === "enterprise"
                        ? `${plan.type} (${selectedDeployment})`
                        : (plan.displayType || plan.type)}
                    </Typography>
                    {plan.deploymentOptions && (
                      <ToggleButtonGroup
                        value={selectedDeployment}
                        exclusive
                        size="small"
                        onChange={(event, newValue) => {
                          if (newValue) {
                            setSelectedDeployment(newValue);
                            if (isCloud) {
                              ReactGA.event({
                                category: "NewPricingPage",
                                action:
                                  "Deployment Type Changed on Features table",
                                label: `${selectedDeployment} -> ${newValue}`,
                              });
                            }
                            window.history.pushState(
                              {},
                              "",
                              window.location.pathname + "?env=" + newValue
                            );
                          }
                        }}
                        sx={{
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "30px",
                          padding: "2px",
                          "& .MuiToggleButton-root": {
                            border: "none",
                            borderRadius: "30px",
                            color: "#fff",
                            padding: "4px 14px",
                            textTransform: "none",
                            fontSize: "12px",
                            "&.Mui-selected": {
                              backgroundColor: "#fff",
                              color: "#222",
                              fontWeight: "bold",
                              "&:hover": {
                                backgroundColor: "#fff",
                              },
                            },
                            "&:hover": {
                              backgroundColor: "rgba(255, 255, 255, 0.2)",
                            },
                          },
                        }}
                      >
                        {plan.deploymentOptions.map((option, idx) => (
                          <Tooltip 
                            key={idx}
                            title={option === "Cloud" ? "Shuffle Cloud" : "Self-Hosted"}
                            arrow
                            placement="top"
                            componentsProps={{
                              tooltip: {
                                sx: {
                                  backgroundColor: "rgba(33, 33, 33, 1)",
                                  color: "#f1f1f1",
                                  fontSize: 13,
                                  border: "1px solid rgba(73, 73, 73, 1)",
                                  boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.4)",
                                  fontFamily: theme?.typography?.fontFamily,
                                  cursor: "default",
                                },
                              },
                            }}
                          >
                            <ToggleButton value={option}>
                              {option === "Cloud" ? (
                                <CloudIcon
                                  selected={selectedDeployment === option}
                                />
                              ) : (
                                <SelfHostedIcon
                                  selected={selectedDeployment === option}
                                />
                              )}
                            </ToggleButton>
                          </Tooltip>
                        ))}
                      </ToggleButtonGroup>
                    )}
                    {plan.type.toLowerCase() === "scale" && (
                      <ToggleButtonGroup
                      value={billingCycle}
                      exclusive
                      onChange={handleBillingCycleChange}
                      aria-label="billing cycle"
                      sx={{
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        fontFamily: theme.typography.fontFamily,
                        borderRadius: "30px",
                        padding: "3px",
                        "& .MuiToggleButton-root": {
                          border: "none",
                          borderRadius: "30px",
                          color: "#fff",
                          padding: {
                            xs: "4px 8px",
                            sm: "3px 10px",
                          },
                          textTransform: "none",
                          fontSize: "12px",
                          fontFamily: theme.typography.fontFamily,
                          transition: "all 0.2s ease-in-out",
                          "&.Mui-selected": {
                            backgroundColor: "#fff",
                            fontFamily: theme.typography.fontFamily,
                            color: "#1A1A1A",
                            fontWeight: "bold",
                            "&:hover": {
                              backgroundColor: "#fff",
                            },
                          },
                          "&:hover:not(.Mui-selected)": {
                            backgroundColor: "rgba(255, 255, 255, 0.2)",
                          },
                        },
                      }}
                    >
                      <ToggleButton value="monthly" aria-label="monthly">
                        M
                      </ToggleButton>
                      <ToggleButton value="annual" aria-label="annual">
                        Y (10% off)
                      </ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  </Box>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Typography
                      component="div"
                      sx={{
                        fontWeight: "bold",
                        color: "#ffffff",
                        fontSize: "24px",
                        display: "flex",
                        flexDirection: "column",
                        lineHeight: 1.15,
                        paddingTop:
                          plan.type.toLowerCase() === "starter"
                            ? 1
                            : plan.type.toLowerCase() === "open source"
                            ? 1
                            : 0,
                      }}
                    >
                      {(plan.type === "Standard" ||
                        (plan.type === "Enterprise" && selectedDeployment === "Cloud")) && (
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#c5c5c5", letterSpacing: "0.3px" }}>
                          Starts from
                        </span>
                      )}
                      <span>
                        {plan.type === "Scale"
                          ? `$${getPrice(32) * (scaleValue / 10)}`
                          : (plan.type === "Standard" ||
                              (plan.type === "Enterprise" && selectedDeployment === "Cloud"))
                          ? `${plan.title}/month`
                          : plan.title}
                      </span>
                    </Typography>

                    {plan.type === "Scale" && (
                      <Typography
                        color="#c5c5c5"
                        sx={{
                          fontSize: "12px",
                          marginBottom: "-2px",
                        }}
                      >
                        /month for {scaleValue}k App Runs
                      </Typography>
                    )}
                  </div>
                  <Button
                    variant="contained"
                    fullWidth
                    disableRipple
                    onClick={plan.buttonAction}
                    sx={{
                      py: 1,
                      borderRadius: "8px",
                      textTransform: "none",
                      fontSize: {
                        xs: "12px",
                        sm: "14px",
                      },
                      marginTop: plan.type.toLowerCase() === "scale" ? -0.5 : 0,
                      color:
                        plan.type.toLowerCase() === "starter"
                          ? "#ffffff"
                          : "#1A1A1A",
                      border: "1.5px solid",
                      borderColor:
                        plan.type.toLowerCase() === "enterprise"
                          ? "transparent"
                          : plan.type.toLowerCase() === "scale" || plan.type.toLowerCase() === "open source"
                          ? "transparent"
                          : isLoggedIn
                          ? "#c5c5c5"
                          : "#ff8544",
                      background:
                        plan.type.toLowerCase() === "enterprise"
                          ? "#2BC07E"
                          : plan.type.toLowerCase() === "scale" || plan.type.toLowerCase() === "open source"
                          ? "#FF8544"
                          : isLoggedIn
                          ? "rgba(255, 255, 255, 0.1)"
                          : "transparent",
                      "&:hover": {
                        background:
                          plan.type.toLowerCase() === "enterprise"
                            ? "#3FDF98"
                            : plan.type.toLowerCase() === "scale" || plan.type.toLowerCase() === "open source"
                            ? "#FF955C"
                            : isLoggedIn
                            ? "rgba(255, 255, 255, 0.1)"
                            : "rgba(255, 133, 68, 0.1)",
                        borderColor:
                          plan.type.toLowerCase() === "enterprise"
                            ? "#3FDF98"
                            : plan.type.toLowerCase() === "scale" || plan.type.toLowerCase() === "open source"
                            ? "transparent"
                            : isLoggedIn
                            ? "#c5c5c5"
                            : "#ff8544",
                        boxShadow: "none",
                        color:
                          plan.type.toLowerCase() === "starter"
                            ? "#ffffff"
                            : "#1A1A1A",
                      },
                      cursor:
                        plan.type.toLowerCase() === "starter" && isLoggedIn
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {plan.buttonText}
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
          <Divider sx={{ my: 2, mt: 0 }} />
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              zIndex: 3,
            }}
          >
            {featuresData[0].features.map((feature, idx) => (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  zIndex: 3,
                }}
              >
                <Box
                  sx={{
                    width: "20%",
                    cursor: "arrow",
                  }}
                >
                  <Tooltip
                    placement="top"
                    onOpen={() => {
                      // Track when tooltip opens (on hover)
                      ReactGA.event({
                        category: "NewPricingPage",
                        action: "Feature Tooltip Hover",
                        label: feature?.name || "Feature",
                      });
                    }}
                    title={
                      <ReactMarkdown
                        components={{
                          a: ({ node, ...props }) => (
                            <a
                              style={{ color: "#FF8544" }}
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            />
                          ),
                        }}
                      >
                        {feature?.description ||
                          `${feature.name}\n\nMore details on [docs](https://shuffler.io/docs) page.`}
                      </ReactMarkdown>
                    }
                    arrow
                    componentsProps={{
                      tooltip: {
                        sx: {
                          backgroundColor: "rgba(33, 33, 33, 1)",
                          color: "rgba(241, 241, 241, 1)",
                          fontSize: 12,
                          border: "1px solid rgba(73, 73, 73, 1)",
                          fontFamily: theme?.typography?.fontFamily,
                          cursor: "default",
                        },
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        color: "#ffffff",
                        fontSize: "14px",
                        width: "fit-content",
                        borderBottom: "1.5px dotted rgba(255,255,255,0.3)",
                        fontFamily: theme.typography.fontFamily,
                        cursor: "default",
                      }}
                    >
                      {feature.name}
                    </Typography>
                  </Tooltip>
                </Box>
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 2,
                    width: "80%",
                    height: "100%",
                  }}
                >
                  {getFilteredFeatures(feature).map((included, idx) => (
                    <Typography
                      key={idx}
                      component="div"
                      sx={{
                        fontSize: "14px",
                        fontFamily: theme.typography.fontFamily,
                        backgroundColor: "#212121",
                        opacity:
                          (included.plan === "Enterprise"
                            ? included.status[selectedDeployment]
                            : included.status) === " "
                            ? "0.4"
                            : included.status
                            ? "1"
                            : "0.4",
                        borderRadius: "8px",
                        width: "100%",
                        p: 1.5,
                        mx: "auto",
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {included.plan === "Enterprise"
                        ? typeof included.status[selectedDeployment] ===
                          "boolean"
                          ? included.status[selectedDeployment] === true
                            ? checkIcon
                            : " "
                          : included.status[selectedDeployment]
                        : typeof included.status === "boolean"
                        ? included.status === true
                          ? checkIcon
                          : " "
                        : included.status}
                    </Typography>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ overflowY: "auto" }}>
            {featuresData.slice(1).map((feature, idx) => (
              <Box
                key={idx}
                sx={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  mt: 8,
                }}
              >
                <Typography
                  id={`feature-title-${idx + 1}`}
                  sx={{
                    color: "#ffffff",
                    fontSize: "16px",
                    fontFamily: theme.typography.fontFamily,
                    fontWeight: "bold",
                  }}
                >
                  {feature.title}
                </Typography>
                <Divider sx={{ my: 1, mb: 2 }} />
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  {feature.features.map((feature, idx) => (
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <Box
                        sx={{
                          width: "20%",
                          cursor: "arrow",
                        }}
                      >
                        <Tooltip
                          placement="top"
                          onOpen={() => {
                            // Track when tooltip opens (on hover)
                            ReactGA.event({
                              category: "NewPricingPage",
                              action: "Feature Tooltip Hover",
                              label: feature?.name || "Feature",
                            });
                          }}
                          title={
                            <ReactMarkdown
                              components={{
                                a: ({ node, ...props }) => (
                                  <a
                                    style={{ color: "#FF8544" }}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    {...props}
                                  />
                                ),
                              }}
                            >
                              {feature?.description ||
                                `${feature.name}\n\nMore details on [docs](https://shuffler.io/docs) page.`}
                            </ReactMarkdown>
                          }
                          arrow
                          componentsProps={{
                            tooltip: {
                              sx: {
                                backgroundColor: "rgba(33, 33, 33, 1)",
                                color: "rgba(241, 241, 241, 1)",
                                fontSize: 12,
                                border: "1px solid rgba(73, 73, 73, 1)",
                                fontFamily: theme?.typography?.fontFamily,
                                cursor: "default",
                              },
                            },
                          }}
                        >
                          <Typography
                            sx={{
                              color: "#ffffff",
                              fontSize: "14px",
                              width: "fit-content",
                              borderBottom:
                                "1.5px dotted rgba(255,255,255,0.3)",
                              fontFamily: theme.typography.fontFamily,
                              cursor: "default",
                            }}
                          >
                            {feature.name}
                          </Typography>
                        </Tooltip>
                      </Box>
                      <Box
                        sx={{
                          width: "100%",
                          display: "flex",
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 2,
                          width: "80%",
                          height: "100%",
                        }}
                      >
                        {getFilteredFeatures(feature).map((included, idx) => (
                          <Typography
                            key={idx}
                            component="div"
                            sx={{
                              fontSize: "14px",
                              fontFamily: theme.typography.fontFamily,
                              backgroundColor: "#212121",
                              opacity:
                                (included.plan === "Enterprise"
                                  ? included.status[selectedDeployment]
                                  : included.status) === " "
                                  ? "0.4"
                                  : included.status
                                  ? "1"
                                  : "0.4",
                              borderRadius: "8px",
                              color: "#ffffff",
                              width: "100%",
                              p: 1.5,
                              mx: "auto",
                              textAlign: "center",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {included.plan === "Enterprise"
                              ? typeof included.status[selectedDeployment] ===
                                "boolean"
                                ? included.status[selectedDeployment] === true
                                  ? checkIcon
                                  : " "
                                : included.status[selectedDeployment]
                              : typeof included.status === "boolean"
                              ? included.status === true
                                ? checkIcon
                                : " "
                              : included.status}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
            <Divider sx={{ my: 2, mt: 4 }} />
            <div id="end-of-features"></div>
          </Box>
        </Box>

        <FAQSection />
      </Box>
      <GetStartedSection />
    </Box>
  );
};

export default PricingPage;
