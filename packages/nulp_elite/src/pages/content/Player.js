import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import Footer from "components/Footer";
import Header from "components/header";
import Container from "@mui/material/Container";
import FloatingChatIcon from "../../components/FloatingChatIcon";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { SunbirdPlayer } from "@shiksha/common-lib";
import * as util from "../../services/utilService";
import axios from "axios";
import Link from "@mui/material/Link";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import FeedbackPopup from "components/FeedbackPopup";
import {
  FacebookShareButton,
  WhatsappShareButton,
  LinkedinShareButton,
  TwitterShareButton,
  FacebookIcon,
  WhatsappIcon,
  LinkedinIcon,
} from "react-share";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import md5 from "md5";
import { isEmpty, set } from "lodash";
const urlConfig = require("../../configs/urlConfig.json");
const routeConfig = require("../../configs/routeConfig.json");
const Player = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [trackData, setTrackData] = useState();
  const [previousRoute, setPreviousRoute] = useState("");
  const [userFirstName, setUserFirstName] = useState("");
  const [userLastName, setUserLastName] = useState("");
  const [courseName, setCourseName] = useState(location.state?.coursename);
  // const [batchId, setBatchId] = useState(location.state?.batchid);
  // const [courseId, setCourseId] = useState(params.get("courseId"));
  const shareUrl = window.location.href; // Current page URL
  const [isEnrolled, setIsEnrolled] = useState(
    location.state?.isenroll || undefined
  );
  const [consumedContent, setConsumedContents] = useState(
    location.state?.consumedcontents || []
  );
  const [courseHierarchy, setCourseHierarchy] = useState(
    location.state?.courseHierarchy
  );
  const [allContents, setAllContents] = useState(
    location.state?.allContents || []
  );
  const [lesson, setLesson] = useState();
  const [isCompleted, setIsCompleted] = useState(false);
  const [openFeedBack, setOpenFeedBack] = useState(false);
  const [hybridFormSlug, setHybridFormSlug] = useState(null);
  const [hybridCtaVisible, setHybridCtaVisible] = useState(false);
  const [assessEvents, setAssessEvents] = useState([]);
  const [propLength, setPropLength] = useState();
  const [hasCalledUpdateAPI, setHasCalledUpdateAPI] = useState(false);
  const _userId = util.userId();
  const [isLearnathon, setIsLearnathon] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [pollId, setPollId] = useState();
  const [learnathonDetails, setLearnathonDetails] = useState();
  const [isPublished, setIsPublished] = useState(false);

  const params = new URLSearchParams(location.search);
  const pageParam = params.get("page");
  const [contentId, setContentId] = useState(() => {
    const id = params.get("id");
    return id && id.endsWith("=") ? id.slice(0, -1) : id;
  });
  const [courseId, setCourseId] = useState(params.get("cId"));
  const [batchId, setBatchId] = useState(params.get("bId"));

  const [playerContent, setPlayerContent] = useState();
  const [noPreviewAvailable, setNoPreviewAvailable] = useState(false);
  const [isEndEventReceived, setIsEndEventReceived] = useState(false);
  // Timestamp of the last END event. Separate from isEndEventReceived, which is
  // reset once the content state has been submitted.
  const [assessmentEndedAt, setAssessmentEndedAt] = useState(null);
  // null while the player is running; otherwise { status, score, maxScore, criteria }
  // where status is "checking" | "passed" | "failed".
  const [assessmentResult, setAssessmentResult] = useState(null);
  // Bumped to remount the player iframe, which restarts the content.
  const [playerInstance, setPlayerInstance] = useState(0);
  // Batch pass criteria doesn't change between attempts in the same session, so
  // it is fetched once and reused - each Redo previously fired it again, adding
  // an extra concurrent authenticated request on every attempt.
  const criteriaCacheRef = useRef({ batchId: null, known: false, value: undefined });
  // Attempts made so far this session (the initial load counts as attempt 1),
  // as a floor under the server's recorded count - see the comment in
  // resolveAssessmentResult on why the two can disagree by one.
  const attemptsThisSessionRef = useRef(1);

  // const playerUrl = `${window.location.origin}/newplayer`;
  const playerUrl =
    window.location.origin != "http://localhost:3000"
      ? `${window.location.origin}/newplayer`
      : "https://nulp.niua.org/newplayer";

  let extractedRoles;
  const [reviewEnable, setReviewEnable] = useState(false);

  // Helper function to update state from location.state
  const updateStateFromLocation = useCallback((state) => {
    if (!state) return;
    
    if (state.coursename) setCourseName(state.coursename);
    if (state.courseHierarchy) setCourseHierarchy(state.courseHierarchy);
    if (state.allContents) setAllContents(state.allContents);
    if (state.consumedcontents) setConsumedContents(state.consumedcontents);
    if (state.isenroll !== undefined) setIsEnrolled(state.isenroll);
  }, []);

  // Update contentId and state when URL changes
  useEffect(() => {
    const newParams = new URLSearchParams(location.search);
    const newContentId = newParams.get("id");
    const newCourseId = newParams.get("cId");
    const newBatchId = newParams.get("bId");
    
    if (newContentId) {
      const cleanedId = newContentId.endsWith("=") ? newContentId.slice(0, -1) : newContentId;
      setContentId(cleanedId);
      
      // Reset lesson state when content changes
      setLesson(null);
      setIsCompleted(false);
      setAssessEvents([]);
      setPropLength(undefined);
      setIsEndEventReceived(false);
      setHasCalledUpdateAPI(false);
    }
    
    if (newCourseId) setCourseId(newCourseId);
    if (newBatchId) setBatchId(newBatchId);
    
    updateStateFromLocation(location.state);
  }, [location.search, location.state, updateStateFromLocation]);

  const fetchUserData = useCallback(async () => {
    if (!_userId) {
      return;
    }
    try {
      const userData = await util.userData();
      extractedRoles = userData?.data?.result?.response.roles.map(
        (roleObj) => roleObj.role
      );
      setUserFirstName(userData?.data?.result?.response?.firstName);
      setUserLastName(userData?.data?.result?.response?.lastName);
      checkIsReview();
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }, []);

  const handleTrackData = useCallback(
    async ({ score, trackData, attempts, ...props }, playerType = "quml") => {
      if (!_userId) {
        return;
      }
      console.log("propLength", Object.keys(props).length);
      console.log("playerType", playerType);
      console.log("assessEvents.length", assessEvents.length);

      setPropLength(Object.keys(props).length);
      CheckfeedBackSubmitted();

      if (
        playerType === "pdf-video" &&
        props.currentPage === props.totalPages
      ) {
        setIsCompleted(true);
      }
      // else if (playerType === "ecml" && propLength === assessEvents.length) {
      //   await updateContentStateForAssessment();
      // }
    },
    [assessEvents, _userId]
  );

  const handleAssessmentData = async (data) => {
    console.log("handleAssessmentData called with data:", data);
    console.log("Current assessEvents state:", assessEvents);

    if (data.eid === "ASSESS") {
      console.log("Processing ASSESS event");

      setAssessEvents((prevAssessEvents) => {
        console.log("Previous assessEvents:", prevAssessEvents);

        const updatedAssessEvents = [...prevAssessEvents, data];
        console.log("Updated assessEvents:", updatedAssessEvents);

        return updatedAssessEvents;
      });

      // setAssessEvents(...assessEvents, data);
    } else if (data.eid === "END") {
      console.log(
        "END event received. Waiting for assessEvents to match propLength..."
      );
      setIsEndEventReceived(true); // mark END event received
      setAssessmentEndedAt(Date.now());
      // await updateContentState(2);
    } else if (data.eid === "START" && playerType === "ecml") {
      // console.log("Processing START event for ecml");
      await updateContentState(1);
    } else if (data.eid === "START" && playerType != "ecml") {
      // console.log("Processing START event for non-ecml");
      await updateContentState(2);
    }
  };

  // Add useEffect to track assessEvents changes
  useEffect(() => {
    console.log("assessEvents state changed:", assessEvents);
  }, [assessEvents]);

  useEffect(() => {
    console.log("Component mounted");

    return () => {
      console.log("Component unmounted");
    };
  }, []);

  function formatDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-based
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

    const offset = -now.getTimezoneOffset();
    const offsetHours = String(Math.floor(Math.abs(offset) / 60)).padStart(
      2,
      "0"
    );
    const offsetMinutes = String(Math.abs(offset) % 60).padStart(2, "0");
    const offsetSign = offset >= 0 ? "+" : "-";

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}:${milliseconds}${offsetSign}${offsetHours}${offsetMinutes}`;
  }

  function getCurrentTimestamp() {
    return Date.now();
  }

  const attemptid = () => {
    const timestamp = new Date().getTime();
    const string = [courseId, batchId, contentId, _userId, timestamp].join("-");
    const hashValue = md5(string);
    return hashValue;
  };

  const updateContentStateForAssessment = useCallback(async () => {
    if (!_userId) {
      return;
    }
    // await updateContentState(2);
    try {
      console.log("end assessment", courseId);
      const url = `${urlConfig.URLS.CONTENT_PREFIX}${urlConfig.URLS.COURSE.USER_CONTENT_STATE_UPDATE}`;
      const requestBody = {
        request: {
          userId: _userId,
          contents: [
            {
              contentId: contentId,
              batchId: batchId,
              status: 2,
              courseId: courseId,
              lastAccessTime: formatDate(),
            },
          ],
          assessments: [
            {
              assessmentTs: getCurrentTimestamp(),
              batchId: batchId,
              courseId: courseId,
              userId: _userId,
              attemptId: attemptid(),
              contentId: contentId,
              events: assessEvents,
            },
          ],
        },
      };
      const response = await axios.patch(url, requestBody);
      console.log("Assessment state updated successfully");
      setHybridCtaVisible(true);
    } catch (error) {
      console.error("Error updating content state:", error);
    }
  }, [_userId, contentId, batchId, courseId, assessEvents]);

  // ── Assessment result ─────────────────────────────────────────────────────
  // Shown over the player once an assessment ends: whether the learner cleared
  // the batch's pass criteria. Mirrors the check the course page does.

  const isAssessmentContent = useMemo(() => {
    const primaryCategory = (lesson?.primaryCategory || "").toLowerCase();
    const contentType = (lesson?.contentType || "").toLowerCase();
    return primaryCategory === "course assessment" || contentType === "selfassess";
  }, [lesson]);

  // Score of the attempt that just finished, from its ASSESS telemetry.
  const scoreFromAssessEvents = (events) => {
    let score = 0;
    let maxScore = 0;
    (events || []).forEach((event) => {
      const edata = event?.edata;
      if (typeof edata?.score === "number") {
        score += edata.score;
      }
      if (typeof edata?.item?.maxscore === "number") {
        maxScore += edata.item.maxscore;
      }
    });
    return { score, maxScore };
  };

  // Pass percentage off the batch certificate template, or undefined when the
  // batch has none configured.
  const readScoreCriteria = (result) => {
    const response = result?.response;
    const certTemplates = response?.certTemplates || response?.cert_templates;
    if (!certTemplates || typeof certTemplates !== "object") {
      return undefined;
    }
    const templateId = Object.keys(certTemplates)[0];
    const criteria = certTemplates[templateId]?.criteria?.assessment;
    const value = Number(criteria?.score?.[">="]);
    return Number.isFinite(value) ? value : undefined;
  };

  // Max attempts allowed for this content, from the batch's course hierarchy -
  // the same source and fallback the course page already uses to show
  // "X/Y attempts left" before the learner even opens the content, so the
  // limit enforced here always matches what was advertised there.
  const findMaxAttempts = (targetContentId, children) => {
    for (const child of children || []) {
      if (child.children) {
        for (const grandchild of child.children) {
          if (grandchild.identifier === targetContentId && grandchild.maxAttempts) {
            return grandchild.maxAttempts;
          }
        }
      }
    }
    return 10; // Default if not found - matches joinCourse.js's own fallback.
  };

  // Attempts already recorded on the server for this content.
  const readRecordedAttemptCount = (result) => {
    const entry = result?.contentList?.find(
      (item) => item?.contentId === contentId
    );
    return Array.isArray(entry?.score) ? entry.score.length : 0;
  };

  // Best percentage across the attempts the server already has on record.
  const readRecordedBestPercentage = (result) => {
    const entry = result?.contentList?.find(
      (item) => item?.contentId === contentId
    );
    if (!Array.isArray(entry?.score) || entry.score.length === 0) {
      return undefined;
    }
    const best = entry.score.reduce((bestSoFar, current) =>
      Number.parseFloat(current.totalScore) >
      Number.parseFloat(bestSoFar.totalScore)
        ? current
        : bestSoFar
    );
    const scored = Number.parseFloat(best.totalScore);
    const maxScore = Number.parseFloat(best.totalMaxScore);
    if (!Number.isFinite(scored) || !Number.isFinite(maxScore) || !maxScore) {
      return undefined;
    }
    return (scored / maxScore) * 100;
  };

  const resolveAssessmentResult = useCallback(async () => {
    const { score, maxScore } = scoreFromAssessEvents(assessEvents);
    const currentAttempt = maxScore > 0 ? (score / maxScore) * 100 : undefined;
    setAssessmentResult({ status: "checking", score, maxScore });

    // Both APIs need a session. Without one we cannot confirm a pass, and we
    // must not claim one. Attempt limits can't be resolved without course
    // context either, so Redo stays available - same as the legacy plugin,
    // which only enforced this for "Course Assessment" content.
    if (!_userId || !batchId || !courseId) {
      setAssessmentResult({ status: "failed", score, maxScore });
      return;
    }

    const maxAttempts = courseHierarchy?.children
      ? findMaxAttempts(contentId, courseHierarchy.children)
      : undefined;

    // Reuse the criteria from an earlier attempt this session instead of
    // firing another authenticated request - see criteriaCacheRef above.
    let criteriaKnown = criteriaCacheRef.current.batchId === batchId
      && criteriaCacheRef.current.known;
    let criteria = criteriaKnown ? criteriaCacheRef.current.value : undefined;

    if (!criteriaKnown) {
      try {
        const url = `${urlConfig.URLS.LEARNER_PREFIX}${urlConfig.URLS.BATCH.GET_DETAILS}/${batchId}`;
        const response = await axios.get(url);
        criteria = readScoreCriteria(response?.data?.result);
        criteriaKnown = true;
        criteriaCacheRef.current = { batchId, known: true, value: criteria };
      } catch (error) {
        console.error("Unable to read batch pass criteria:", error);
      }
    }

    // Sequenced after the criteria request rather than run alongside it -
    // firing two authenticated requests together is what makes a Keycloak
    // grant-refresh race (see server.js's stale-session check) far more
    // likely to clear the portal session cookie mid-request.
    let recordedBest;
    let recordedAttemptCount = 0;
    try {
      const url = `${urlConfig.URLS.CONTENT_PREFIX}${urlConfig.URLS.COURSE.USER_CONTENT_STATE_READ}`;
      const response = await axios.post(url, {
        request: {
          userId: _userId,
          courseId,
          contentIds: [contentId],
          batchId,
          fields: ["progress", "score"],
        },
      });
      recordedBest = readRecordedBestPercentage(response?.data?.result);
      recordedAttemptCount = readRecordedAttemptCount(response?.data?.result);
    } catch (error) {
      console.error("Unable to read recorded assessment scores:", error);
    }

    // The attempt that just finished is submitted to the server on a short
    // delay (see updateContentStateForAssessment), so it may not be reflected
    // in recordedAttemptCount yet - the +1 accounts for it, same as the legacy
    // plugin's "content.currentAttempt = content.currentAttempt + 1". The
    // session-local counter is a floor under that, in case the server call
    // above failed or the delayed submit landed even later than expected.
    const attemptsUsed = Math.max(
      recordedAttemptCount + 1,
      attemptsThisSessionRef.current
    );
    const attemptsExhausted =
      maxAttempts !== undefined && attemptsUsed >= maxAttempts;

    // The attempt that just finished may not have reached the server yet, so it
    // is considered alongside what is on record.
    const percentages = [recordedBest, currentAttempt].filter((value) =>
      Number.isFinite(value)
    );
    const bestPercentage = percentages.length
      ? Math.max(...percentages)
      : undefined;

    // Could not reach the criteria - say nothing about passing.
    if (!criteriaKnown) {
      setAssessmentResult({ status: "failed", score, maxScore, attemptsExhausted });
      return;
    }
    // Batch genuinely has no pass criteria - nothing to fail against.
    if (criteria === undefined) {
      setAssessmentResult({ status: "passed", score, maxScore });
      return;
    }
    setAssessmentResult({
      status:
        Number.isFinite(bestPercentage) && bestPercentage >= criteria
          ? "passed"
          : "failed",
      score,
      maxScore,
      criteria,
      attemptsExhausted,
    });
  }, [assessEvents, _userId, batchId, courseId, contentId, courseHierarchy]);

  // resolveAssessmentResult is rebuilt whenever assessEvents changes, so the
  // timestamp is tracked to keep this to one resolution per attempt.
  const resolvedEndRef = useRef(null);

  useEffect(() => {
    if (!assessmentEndedAt || !isAssessmentContent) {
      return;
    }
    if (resolvedEndRef.current === assessmentEndedAt) {
      return;
    }
    resolvedEndRef.current = assessmentEndedAt;
    resolveAssessmentResult();
  }, [assessmentEndedAt, isAssessmentContent, resolveAssessmentResult]);

  const redoAssessment = useCallback(() => {
    attemptsThisSessionRef.current += 1;
    resolvedEndRef.current = null;
    setAssessmentResult(null);
    setAssessmentEndedAt(null);
    setAssessEvents([]);
    setPropLength(undefined);
    setIsEndEventReceived(false);
    setHasCalledUpdateAPI(false);
    setPlayerInstance((instance) => instance + 1);
  }, []);

  useEffect(() => {
    console.log(
      "##########################################################################"
    );
    console.log("useEffect isEndEventReceived -", isEndEventReceived);
    console.log("useEffect assessEvents.length - ", assessEvents.length);
    console.log("useEffect propLength - ", propLength);
    console.log("useEffect hasCalledUpdateAPI - ", hasCalledUpdateAPI);

    // Prevent duplicate API calls
    if (hasCalledUpdateAPI) {
      return;
    }

    // Check if END event is received and we have assessment events
    if (isEndEventReceived && assessEvents.length > 0) {
      // If propLength is defined and matches, call API immediately
      if (propLength !== undefined && propLength === assessEvents.length) {
        console.log(
          "Calling updateContentState with status 2 after all assessments and END event (exact match)"
        );
        if (!_userId) {
          return;
        }
        setHasCalledUpdateAPI(true);
        updateContentStateForAssessment();

        // Reset flag to prevent repeated calls
        setIsEndEventReceived(false);
        return;
      }

      // If propLength doesn't match or is undefined, set a timeout fallback
      // This ensures the API is called even if propLength never matches
      const timeoutId = setTimeout(() => {
        console.log(
          `Calling updateContentState with status 2 after END event (timeout fallback) - propLength: ${propLength}, assessEvents.length: ${assessEvents.length}`
        );
        if (!_userId || hasCalledUpdateAPI) {
          return;
        }
        setHasCalledUpdateAPI(true);
        updateContentStateForAssessment();

        // Reset flag to prevent repeated calls
        setIsEndEventReceived(false);
      }, propLength === undefined ? 1000 : 2000); // Wait longer if propLength is set but doesn't match

      return () => clearTimeout(timeoutId);
    }
  }, [isEndEventReceived, assessEvents, propLength, _userId, updateContentStateForAssessment, hasCalledUpdateAPI]);

  useEffect(() => {
    const fetchHybridFormSlug = async () => {
      try {
        const url = `/registration-module/api/v1/admin/hybrid-registration/forms?nulpPublishedOnly=true`;
        const response = await axios.get(url);
        const slug = response.data?.data?.[0]?.slug;
        if (slug) {
          setHybridFormSlug(slug);
        }
      } catch (error) {
        console.error("Error fetching hybrid registration form:", error);
      }
    };
    fetchHybridFormSlug();
  }, []);

  useEffect(() => {
    if (!_userId || !courseId || !batchId || !contentId) return;
    const fetchAssessmentCompletion = async () => {
      try {
        const url = `${urlConfig.URLS.CONTENT_PREFIX}${urlConfig.URLS.COURSE.USER_CONTENT_STATE_READ}`;
        const requestBody = {
          request: {
            userId: _userId,
            courseId,
            contentIds: [contentId],
            batchId,
            fields: ["progress", "score"],
          },
        };
        const response = await axios.post(url, requestBody);
        const contentList = response.data?.result?.contentList || [];
        const progress = contentList.find(
          (item) => item.contentId === contentId
        );
        const isCompleted =
          progress?.status === 2 &&
          Array.isArray(progress.score) &&
          progress.score.some(
            (attempt) =>
              Number.isFinite(Number(attempt.totalScore)) &&
              Number.isFinite(Number(attempt.totalMaxScore))
          );
        if (isCompleted) {
          setHybridCtaVisible(true);
        }
      } catch (error) {
        console.error("Error reading content state:", error);
      }
    };
    fetchAssessmentCompletion();
  }, [_userId, courseId, batchId, contentId]);

  const CheckfeedBackSubmitted = async () => {
    try {
      const url = `${urlConfig.URLS.FEEDBACK.LIST}`;
      const RequestBody = {
        request: {
          filters: {
            content_id: contentId,
            user_id: _userId,
          },
        },
      };
      const response = await axios.post(url, RequestBody);
      console.log(response.data);
      if (response.data?.result?.totalCount === 0) {
        setOpenFeedBack(true);
      } else {
        setOpenFeedBack(false);
      }
    } catch (error) {
      console.error("Error fetching course data:", error);
    }
  };

  function checkIsReview() {
    if (
      pageParam == "review" &&
      extractedRoles.includes("SYSTEM_ADMINISTRATION")
    ) {
      setReviewEnable(true);
    } else if (
      pageParam == "lern" &&
      extractedRoles.includes("SYSTEM_ADMINISTRATION")
    ) {
      setReviewEnable(true);
    }
  }

  const updateContentState = useCallback(
    async (status) => {
      if (!_userId) {
        return;
      }
      // if (isEnrolled) {
      const url = `${urlConfig.URLS.CONTENT_PREFIX}${urlConfig.URLS.COURSE.USER_CONTENT_STATE_UPDATE}`;
      await axios.patch(url, {
        request: {
          userId: _userId,
          contents: [{ contentId, courseId, batchId, status }],
        },
      });
      // }
    },
    [isEnrolled, _userId, contentId, courseId, batchId]
  );

  const replaceDomain = (obj, oldDomain, newDomain) => {
    if (typeof obj === "string") {
      return obj.replace(new RegExp(oldDomain, "g"), newDomain);
    } else if (Array.isArray(obj)) {
      return obj.map((item) => replaceDomain(item, oldDomain, newDomain));
    } else if (typeof obj === "object" && obj !== null) {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        acc[key] = replaceDomain(value, oldDomain, newDomain);
        return acc;
      }, {});
    }

    return obj;
  };

  useEffect(() => {
    // Get contentId from URL to ensure we're using the latest value
    const params = new URLSearchParams(location.search);
    const urlContentId = params.get("id");
    const actualContentId = urlContentId && urlContentId.endsWith("=") 
      ? urlContentId.slice(0, -1) 
      : urlContentId;
    
    if (!actualContentId) {
      setLesson(null);
      return;
    }
    
    // Ensure contentId state matches URL
    if (actualContentId !== contentId) {
      setContentId(actualContentId);
      return; // Let the URL change effect handle the update first
    }
    
    setPreviousRoute(sessionStorage.getItem("previousRoutes"));
    
    // Reset lesson to show loading state
    setLesson(null);
    
    const fetchData = async (content_Id) => {
      if (!content_Id) return;
      try {
        const response = await fetch(
          `${urlConfig.URLS.PUBLIC_PREFIX}${urlConfig.URLS.CONTENT.GET}/${content_Id}?fields=transcripts,ageGroup,appIcon,artifactUrl,attributions,attributions,audience,author,badgeAssertions,board,body,channel,code,concepts,contentCredits,contentType,contributors,copyright,copyrightYear,createdBy,createdOn,creator,creators,description,displayScore,domain,editorState,flagReasons,flaggedBy,flags,framework,gradeLevel,identifier,itemSetPreviewUrl,keywords,language,languageCode,lastUpdatedOn,license,mediaType,medium,mimeType,name,originData,osId,owner,pkgVersion,publisher,questions,resourceType,scoreDisplayConfig,status,streamingUrl,subject,template,templateId,totalQuestions,totalScore,versionKey,visibility,year,primaryCategory,additionalCategories,interceptionPoints,interceptionType&orgdetails=orgName,email&licenseDetails=name,description,url`,
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        if (!response.ok) throw new Error("Failed to fetch course data");
        const data = await response.json();
        console.log("data.result.content", data.result.content);
        const updatedResponse = replaceDomain(
          data.result.content,
          "nulpstorage1.blob.core.windows.net",
          "nulpstorage.blob.core.windows.net"
        );
        console.log("updatedResponse", updatedResponse);

        // Only set lesson if contentId hasn't changed during fetch
        const currentParams = new URLSearchParams(globalThis.location.search);
        const currentContentId = currentParams.get("id");
        const currentCleanedId = currentContentId && currentContentId.endsWith("=") 
          ? currentContentId.slice(0, -1) 
          : currentContentId;
        
        if (currentCleanedId === content_Id) {
          setLesson(updatedResponse);
        }
      } catch (error) {
        console.error("Error fetching course data:", error);
        setLesson(null);
      }
    };

    if (pageParam != "vote") {
      if (
        pageParam == "review" ||
        pageParam == "lern" ||
        pageParam == "lernpreview" ||
        pageParam == "dashboard"
      ) {
        setIsLearnathon(true);

        const assetBody = {
          request: {
            filters: {
              learnathon_content_id: contentId,
            },
          },
        };
        
        fetch(`${urlConfig.URLS.LEARNATHON.LIST}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(assetBody),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("Something went wrong");
            }
            const result = await response.json();
            console.log("suceesss----", result);
            console.log(result.result);

            setLearnathonDetails(result.result.data[0]);
            setPlayerContent(result.result.data[0].content_id);
            if (result.result.data[0].status == "Live") {
              setIsPublished(true);
            }

            if (result.result.data[0].content_id === null || undefined) {
              setNoPreviewAvailable(true);
            } else {
              fetchData(result.result.data[0].content_id);
            }
          })
          .catch((error) => {
            console.log("error---", error);
          });
      } else {
        fetchData(actualContentId);
      }

      fetchUserData();
      if (actualContentId && consumedContent && !consumedContent.includes(actualContentId)) {
        updateContentState(2);
      }
    }
  }, [location.search, contentId, consumedContent, fetchUserData, updateContentState, pageParam]);

  useEffect(() => {
    if (isCompleted) {
      updateContentState(2);
    }
  }, [isCompleted, updateContentState]);

  const handleClose = () => setOpenFeedBack(false);
  const handleGoBack = () => navigate(sessionStorage.getItem("previousRoutes"));
  const handleBackNavigation = () => {
    console.log("pageParam - ", pageParam);
    if (pageParam == "vote") {
      navigate("/webapp/lernvotinglist");
      window.location.reload();
    } else if (pageParam == "lern") {
      navigate("/webapp/lernreviewlist", { state: { backPage: "player" } });
      window.location.reload();
    } else if (pageParam == "lernpreview") {
      navigate("/webapp/mylernsubmissions");
      window.location.reload();
    } else if (pageParam == "dashboard") {
      navigate("/webapp/learndashboard");
      window.location.reload();
    } else {
      console.log(
        "sessionStorage.getItem(previousRoutes) - ",
        sessionStorage.getItem("previousRoutes")
      );
      const back =
        sessionStorage.getItem("courseOrigin") ||
        sessionStorage.getItem("previousRoutes");
      if (back) {
        sessionStorage.removeItem("courseOrigin");
        navigate(back);
        window.location.reload();
      } else {
        navigate(-1); // Navigate back in history
      }
    }
  };

  // Helper function to build a flat list of content with module information
  const buildContentList = (hierarchy) => {
    const contentList = [];
    
    if (!hierarchy || !hierarchy.children) {
      return contentList;
    }

    const traverse = (nodes, moduleInfo = null) => {
      for (const node of nodes) {
        if (!node.children || node.children.length === 0) {
          // This is a leaf node (content)
          contentList.push({
            identifier: node.identifier,
            name: node.name,
            moduleIdentifier: moduleInfo?.identifier || null,
            moduleName: moduleInfo?.name || null,
          });
        } else {
          // This is a module/unit
          const currentModuleInfo = {
            identifier: node.identifier,
            name: node.name,
          };
          traverse(node.children, currentModuleInfo);
        }
      }
    };

    traverse(hierarchy.children);
    return contentList;
  };

  // Helper function to find first content in a module
  const findFirstContentInModule = (contentList, moduleIdentifier) => {
    for (const item of contentList) {
      if (item.moduleIdentifier === moduleIdentifier) {
        return {
          identifier: moduleIdentifier,
          name: item.moduleName,
          firstContentId: item.identifier,
        };
      }
    }
    return null;
  };

  // Helper function to find previous module
  const findPreviousModule = (contentList, currentIndex, currentModuleIdentifier) => {
    if (!currentModuleIdentifier) return null;
    
    // Find the first different module going backwards
    for (let i = currentIndex - 1; i >= 0; i--) {
      const item = contentList[i];
      if (
        item.moduleIdentifier &&
        item.moduleIdentifier !== currentModuleIdentifier
      ) {
        return findFirstContentInModule(contentList, item.moduleIdentifier);
      }
    }
    return null;
  };

  // Helper function to find next module
  const findNextModule = (contentList, currentIndex, currentModuleIdentifier) => {
    if (!currentModuleIdentifier) return null;
    
    // Find the first different module going forwards
    for (let i = currentIndex + 1; i < contentList.length; i++) {
      const item = contentList[i];
      if (
        item.moduleIdentifier &&
        item.moduleIdentifier !== currentModuleIdentifier
      ) {
        return findFirstContentInModule(contentList, item.moduleIdentifier);
      }
    }
    return null;
  };

  // Get navigation information for current content
  const getNavigationInfo = () => {
    const emptyResult = {
      previousContent: null,
      nextContent: null,
      previousModule: null,
      nextModule: null,
    };

    if (!courseHierarchy || !contentId || !allContents || allContents.length === 0) {
      return emptyResult;
    }

    const contentList = buildContentList(courseHierarchy);
    const currentIndex = contentList.findIndex(
      (item) => item.identifier === contentId
    );

    if (currentIndex === -1) {
      return emptyResult;
    }

    const currentContent = contentList[currentIndex];
    const previousContent = currentIndex > 0 ? contentList[currentIndex - 1] : null;
    const nextContent =
      currentIndex < contentList.length - 1 ? contentList[currentIndex + 1] : null;

    const previousModule = findPreviousModule(
      contentList,
      currentIndex,
      currentContent.moduleIdentifier
    );
    const nextModule = findNextModule(
      contentList,
      currentIndex,
      currentContent.moduleIdentifier
    );

    return {
      previousContent,
      nextContent,
      previousModule,
      nextModule,
    };
  };

  // Navigate to a content item
  const navigateToContent = (targetContentId) => {
    if (!targetContentId) return;
    
    // Reset lesson immediately to show loading state
    setLesson(null);
    
    navigate(
      `${routeConfig.ROUTES.PLAYER_PAGE.PLAYER}?id=${targetContentId}&cId=${courseId}&bId=${batchId}`,
      {
        replace: false,
        state: {
          coursename: courseName,
          batchid: batchId,
          courseid: courseId,
          isenroll: isEnrolled,
          consumedcontents: consumedContent,
          courseHierarchy: courseHierarchy,
          allContents: allContents,
        },
      }
    );
  };

  const navigationInfo = useMemo(() => getNavigationInfo(), [courseHierarchy, contentId, allContents]);

  // Video/PDF content keeps a fixed 16:9 box; question/assessment/document content reflows
  // with zoom and viewport width, so it needs a flexible height instead of a clipped ratio box.
  const FIXED_RATIO_MIME_TYPES = [
    "video/mp4",
    "video/webm",
    "video/x-youtube",
    "application/pdf",
    "application/vnd.ekstep.h5p-archive",
  ];
  const isFixedRatioContent = FIXED_RATIO_MIME_TYPES.includes(lesson?.mimeType);

  const fetchData = async (content_Id) => {
    try {
      const response = await fetch(
        `${urlConfig.URLS.PUBLIC_PREFIX}${urlConfig.URLS.CONTENT.GET}/${content_Id}?fields=transcripts,ageGroup,appIcon,artifactUrl,attributions,attributions,audience,author,badgeAssertions,board,body,channel,code,concepts,contentCredits,contentType,contributors,copyright,copyrightYear,createdBy,createdOn,creator,creators,description,displayScore,domain,editorState,flagReasons,flaggedBy,flags,framework,gradeLevel,identifier,itemSetPreviewUrl,keywords,language,languageCode,lastUpdatedOn,license,mediaType,medium,mimeType,name,originData,osId,owner,pkgVersion,publisher,questions,resourceType,scoreDisplayConfig,status,streamingUrl,subject,template,templateId,totalQuestions,totalScore,versionKey,visibility,year,primaryCategory,additionalCategories,interceptionPoints,interceptionType&orgdetails=orgName,email&licenseDetails=name,description,url`,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch course data");
      const data = await response.json();
      console.log("data.result.content", data.result.content);
      const updatedResponse = replaceDomain(
        data.result.content,

        "nulpstorage1.blob.core.windows.net",
        "nulpstorage.blob.core.windows.net"
      );
      console.log("updatedResponse", updatedResponse);

      setLesson(updatedResponse);
    } catch (error) {
      console.error("Error fetching course data:", error);
    }
  };

  const CheckLearnathonContent = async () => {
    const currentDateTime = new Date();
    currentDateTime.setMinutes(currentDateTime.getMinutes() + 2);
    const updatedDateTime = currentDateTime.toISOString();
    console.log(updatedDateTime, "currentDateAndTime");
    try {
      const url = `${urlConfig.URLS.LEARNATHON.LIST}`;
      const requestBody = {
        request: {
          filters: {
            learnathon_content_id: contentId,
            status: "Live",
            // start_date:start_date,
            // end_date:end_date,
          },
        },
      };

      const response = await axios.post(url, requestBody);
      if (response?.data?.result?.totalCount > 0) {
        fetchData(response?.data?.result?.data[0]?.content_id);
        setLearnathonDetails(response?.data?.result?.data[0]);
        setPollId(response?.data?.result?.data[0]?.poll_id);
        setIsLearnathon(true);
      }
    } catch (error) {
      console.error("Error fetching course data:", error);
    }
  };

  const CheckAlreadyVoted = async () => {
    if (!_userId) {
      return;
    }
    if (learnathonDetails?.status === "Live") {
      try {
        const url = `${urlConfig.URLS.POLL.GET_USER_POLL}?poll_id=${pollId}&user_id=${_userId}`;
        const response = await axios.get(url);
        if (
          Array.isArray(response?.data?.result) &&
          response?.data?.result.length !== 0
        ) {
          setAlreadyVoted(true);
        }
      } catch (error) {
        console.error("Error fetching course data:", error);
      }
    }
  };

  useEffect(() => {
    if (pageParam == "vote" || pageParam == "dashboard") {
      CheckLearnathonContent();
    }
  }, [contentId]);
  useEffect(() => {
    if (pageParam == "vote" || pageParam == "dashboard") {
      CheckAlreadyVoted();
    }
  }, [pollId]);

  const handleClick = (poll_id) => {
    navigate(`/webapp/pollDetails?${poll_id}`);
    window.location.reload();
  };
  const Publish = async () => {
    if (!_userId) {
      return;
    }
    const reqBody = {
      request: {
        content: {
          lastPublishedBy: _userId,
        },
      },
    };
    try {
      const response = await fetch(
        `${urlConfig.URLS.LEARNATHON.PUBLISH}/${playerContent}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reqBody),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to Published");
      }

      const result = await response.json();
      console.log("suceesss----", result);
      console.log(result.result);
      const currentDateTime = new Date();
      currentDateTime.setMinutes(currentDateTime.getMinutes() + 2);
      const updatedDateTime = currentDateTime.toISOString();
      console.log(updatedDateTime, "currentDateAndTime");

      const data = {
        title: learnathonDetails?.title_of_submission,
        description: learnathonDetails?.description,
        visibility: "PublicToAll",
        poll_options: ["I would like to vote this content"],
        poll_type: "Polls",
        start_date: urlConfig.LEARNATHON_DATES.VOTING_START_DATE,
        end_date: urlConfig.LEARNATHON_DATES.VOTING_END_DATE,
        is_live_poll_result: true,
        content_id: learnathonDetails?.learnathon_content_id,
        category: "Learnathon",
        content_category: learnathonDetails?.category_of_participation,
      };
      try {
        const response = await fetch(`${urlConfig.URLS.POLL.CREATE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          const responseData = await response.json();
          console.log("responseData----", learnathonDetails);

          const formData = {
            poll_id: responseData.result.data[0].poll_id,
            status: "Live",
            created_by: learnathonDetails.created_by,
            title_of_submission: learnathonDetails.title_of_submission,
            created_by: learnathonDetails.created_by,
          };

          try {
            const response = await fetch(
              `${urlConfig.URLS.LEARNATHON.UPDATE}?id=${contentId}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
              }
            );

            if (!response.ok) {
              throw new Error(t("SOMETHING_WENT_WRONG"));
            } else {
            }

            const result = await response.json();
            console.log("suceesss");
            alert("Published successfully");
            handleBackNavigation();
            window.location.reload();
          } catch (error) {
            throw new Error(t("SOMETHING_WENT_WRONG"));
          } finally {
          }
        } else {
          throw new Error("Failed to create poll");
        }
      } catch (error) {
        // setToasterMessage(error.message);
      }

      // navigate(routeConfig.ROUTES.LEARNATHON.LERNREVIEWLIST);
      // window.location.reload();
      // setData(result.result.data);
      // setTotalRows(result.result.totalCount);
    } catch (error) {
      console.log("error---", error);
      // setError(error.message);
    } finally {
      // setIsLoading(false);
    }
  };
  const Reject = async () => {
    const reqBody = {
      request: {
        content: {
          rejectReasons: [],
          rejectComment: "",
        },
      },
    };
    try {
      const response = await fetch(
        `${urlConfig.URLS.LEARNATHON.REJECT}/${playerContent}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reqBody),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to Reject");
      }

      const result = await response.json();
      console.log("suceesss----", result);
      console.log(result.result);
      const formData = {
        status: "Reject",
        title_of_submission: learnathonDetails.title_of_submission,
        created_by: learnathonDetails.created_by,
      };
      try {
        const response = await fetch(
          `${urlConfig.URLS.LEARNATHON.UPDATE}?id=${contentId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
          }
        );

        if (!response.ok) {
          throw new Error("Something went wrong");
        }

        const result = await response.json();
        console.log("suceesss");
        alert("Content Rejected");

        handleBackNavigation();

        window.location.reload();
      } catch (error) {
      } finally {
      }

      // setData(result.result.data);
      // setTotalRows(result.result.totalCount);
    } catch (error) {
      console.log("error---", error);
      // setError(error.message);
    } finally {
      // setIsLoading(false);
    }
  };

  useEffect(() => {
    if (contentId) {
      localStorage.setItem("playerVisited", "true");
    }
  }, [location.search]);

  return (
    <div>
      <Header />
      {hybridCtaVisible && hybridFormSlug && (
        <Box
          className="hybrid-mode-cta hybrid-banner"
          onClick={() =>
            window.open(`/registration-module/forms/${hybridFormSlug}`, "_blank")
          }
        >
          <span className="hybrid-mode-cta__icon">🎓</span>
          <span className="hybrid-mode-cta__text">
            {t("Click here to enroll in-person hybrid training of this course")}
          </span>
          <span className="hybrid-mode-cta__arrow">➔</span>
        </Box>
      )}
      <Box>
        <Container maxWidth="xl" role="main" className="player mt-15">
          <Grid container spacing={2} className="mt-10 mb-30">
            <Grid item xs={12} md={12} lg={12}>
              <Box
                className="d-flex mr-20 my-20 px-10"
                style={{
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Button
                  onClick={handleBackNavigation}
                  className="custom-btn-primary mr-17 mt-15"
                >
                  {t("BACK")}
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={9} lg={9}>
              <Box>
                {lesson && (
                  <Breadcrumbs
                    aria-label="breadcrumb"
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                    }}
                  >
                    <Link
                      underline="hover"
                      href=""
                      aria-current="page"
                      color="#484848"
                    >
                      {courseName}
                    </Link>
                  </Breadcrumbs>
                )}
                <Box className="h3-title">
                  {isLearnathon
                    ? learnathonDetails?.title_of_submission
                    : lesson?.name}
                </Box>
              </Box>
              <Box>
                {lesson && (
                  <Box className="xs-mb-20 mt-10">
                    <Typography
                      className="h6-title mb-20"
                      style={{
                        display: "inline-block",
                        verticalAlign: "text-top",
                      }}
                    >
                      {t("CONTENT_TAGS")}:{" "}
                    </Typography>
                    {isLearnathon ? (
                      <Button
                        key={`board`}
                        size="small"
                        style={{
                          color: "#424242",
                          fontSize: "10px",
                          margin: "0 10px 3px 6px",
                          cursor: "auto",
                        }}
                        className="bg-blueShade3"
                      >
                        {learnathonDetails.indicative_theme}
                      </Button>
                    ) : (
                      lesson.board && (
                        <Button
                          key={`board`}
                          size="small"
                          style={{
                            color: "#424242",
                            fontSize: "10px",
                            margin: "0 10px 3px 6px",
                            cursor: "auto",
                          }}
                          className="bg-blueShade3"
                        >
                          {lesson.board}
                        </Button>
                      )
                    )}
                    {!isLearnathon &&
                      !lesson.board &&
                      lesson.se_boards &&
                      lesson.se_boards.map((item, index) => (
                        <Button
                          key={`se_boards-${index}`}
                          size="small"
                          style={{
                            color: "#424242",
                            fontSize: "10px",
                            margin: "0 10px 3px 6px",
                            cursor: "auto",
                          }}
                          className="bg-blueShade3"
                        >
                          {item}
                        </Button>
                      ))}
                    {isLearnathon &&
                    learnathonDetails.indicative_sub_theme &&
                    learnathonDetails.indicative_sub_theme != null ? (
                      <Button
                        key={`board`}
                        size="small"
                        style={{
                          color: "#424242",
                          fontSize: "10px",
                          margin: "0 10px 3px 6px",
                          cursor: "auto",
                        }}
                        className="bg-blueShade3"
                      >
                        {learnathonDetails.indicative_sub_theme}
                      </Button>
                    ) : (
                      lesson.gradeLevel &&
                      lesson.gradeLevel.map((item, index) => (
                        <Button
                          key={`gradeLevel-${index}`}
                          size="small"
                          style={{
                            color: "#424242",
                            fontSize: "10px",
                            margin: "0 10px 3px 6px",
                            cursor: "auto",
                          }}
                          className="bg-blueShade3"
                        >
                          {item}
                        </Button>
                      ))
                    )}
                    /
                    {isLearnathon &&
                      learnathonDetails.other_indicative_themes &&
                      learnathonDetails.other_indicative_themes != null && (
                        <Button
                          key={`board`}
                          size="small"
                          style={{
                            color: "#424242",
                            fontSize: "10px",
                            margin: "0 10px 3px 6px",
                            cursor: "auto",
                          }}
                          className="bg-blueShade3"
                        >
                          {learnathonDetails.other_indicative_themes}
                        </Button>
                      )}
                    {!isLearnathon &&
                      !lesson.gradeLevel &&
                      lesson.se_gradeLevels &&
                      lesson.se_gradeLevels.map((item, index) => (
                        <Button
                          key={`se_gradeLevels-${index}`}
                          size="small"
                          style={{
                            color: "#424242",
                            fontSize: "10px",
                            margin: "0 10px 3px 6px",
                            cursor: "auto",
                          }}
                          className="bg-blueShade3"
                        >
                          {item}
                        </Button>
                      ))}
                  </Box>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={3} lg={3} style={{ textAlign: "right" }}>
              <FacebookShareButton url={shareUrl} className="pr-5">
                <FacebookIcon size={32} round={true} />
              </FacebookShareButton>
              <WhatsappShareButton url={shareUrl} className="pr-5">
                <WhatsappIcon size={32} round={true} />
              </WhatsappShareButton>
              <LinkedinShareButton url={shareUrl} className="pr-5">
                <LinkedinIcon size={32} round={true} />
              </LinkedinShareButton>
              <TwitterShareButton url={shareUrl} className="pr-5">
                <img
                  src={require("../../assets/twitter.png")}
                  alt="Twitter"
                  style={{ width: 32, height: 32 }}
                />
              </TwitterShareButton>
            </Grid>
          </Grid>
          <Box
            className={`player-ratio-box${
              isFixedRatioContent ? "" : " player-ratio-box--flexible"
            }`}
          >
            {lesson ? (
              <SunbirdPlayer
                key={playerInstance}
                {...lesson}
                width="100%"
                height="100%"
                userData={{
                  firstName: userFirstName || "",
                  lastName: userLastName || "",
                }}
                telemetryData={(data) => {
                  handleAssessmentData(data);
                }}
                setTrackData={(data) => {
                  const type = lesson?.mimeType;
                  if (
                    [
                      "assessment",
                      "SelfAssess",
                      "QuestionSet",
                      "QuestionSetImage",
                    ].includes(type)
                  ) {
                    handleTrackData(data);
                  } else if (
                    [
                      "application/vnd.ekstep.html-archive",
                      "application/vnd.ekstep.html-archive",
                      "application/epub",
                    ].includes(type)
                  ) {
                    handleTrackData(data);
                  } else if (
                    ["application/vnd.sunbird.questionset"].includes(type)
                  ) {
                    handleTrackData(
                      data,
                      "application/vnd.sunbird.questionset"
                    );
                  } else if (
                    [
                      "application/pdf",
                      "video/mp4",
                      "video/webm",
                      "video/x-youtube",
                      "application/vnd.ekstep.h5p-archive",
                    ].includes(type)
                  ) {
                    handleTrackData(data, "pdf-video");
                  } else if (
                    ["application/vnd.ekstep.ecml-archive"].includes(type)
                  ) {
                    const score = Array.isArray(data)
                      ? data.reduce((old, newData) => old + newData?.score, 0)
                      : 0;
                    handleTrackData({ ...data, score: `${score}` }, "ecml");
                    setTrackData(data);
                  }
                }}
                public_url={playerUrl}
              />
            ) : (
              <Box className="player-empty-state">{t("NO_CONTENT_TO_PLAY")}</Box>
            )}

            {assessmentResult && (
              <Box className="assessment-result">
                {assessmentResult.status === "checking" ? (
                  <Typography className="assessment-result__message">
                    {t("ASSESSMENT_CHECKING_RESULT")}
                  </Typography>
                ) : (
                  <>
                    <Box
                      className={`assessment-result__icon assessment-result__icon--${assessmentResult.status}`}
                      aria-hidden="true"
                    >
                      {assessmentResult.status === "passed" ? "\u2713" : "\u2715"}
                    </Box>
                    <Typography
                      className={`assessment-result__title assessment-result__title--${assessmentResult.status}`}
                    >
                      {assessmentResult.status === "passed"
                        ? t("ASSESSMENT_PASSED_TITLE")
                        : t("ASSESSMENT_FAILED_TITLE")}
                    </Typography>
                    <Typography className="assessment-result__message">
                      {assessmentResult.status === "passed" ? (
                        t("ASSESSMENT_PASSED_MESSAGE")
                      ) : assessmentResult.attemptsExhausted ? (
                        <>
                          {t("YOU_SCORED")} {assessmentResult.score}/
                          {assessmentResult.maxScore}. {t("MAX_ATTEMPTS_EXCEEDED")}
                        </>
                      ) : (
                        <>
                          {t("YOU_SCORED")} {assessmentResult.score}/
                          {assessmentResult.maxScore}. {t("REDO_TO_IMPROVE_SCORE")}
                        </>
                      )}
                    </Typography>
                    {assessmentResult.status === "passed" &&
                      Number.isFinite(assessmentResult.criteria) && (
                        <Typography className="assessment-result__message">
                          {t("CERTIFICATE_DOWNLOAD_HINT")}
                        </Typography>
                      )}
                    {assessmentResult.status === "failed" &&
                      !assessmentResult.attemptsExhausted && (
                        <Button
                          variant="outlined"
                          className="assessment-result__redo"
                          onClick={redoAssessment}
                        >
                          {t("REDO")}
                        </Button>
                      )}
                  </>
                )}
              </Box>
            )}
          </Box>

          {/* Navigation Buttons */}
          {courseHierarchy && courseId && (
            <Box
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "20px",
                marginBottom: "20px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <Box style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {navigationInfo.previousModule && (
                  <Button
                    variant="outlined"
                    onClick={() =>
                      navigateToContent(navigationInfo.previousModule.firstContentId)
                    }
                    className="custom-btn-outline"
                    disabled={!navigationInfo.previousModule}
                  >
                    {t("PREVIOUS_MODULE")}
                  </Button>
                )}
                {navigationInfo.previousContent && (
                  <Button
                    variant="outlined"
                    onClick={() =>
                      navigateToContent(navigationInfo.previousContent.identifier)
                    }
                    className="custom-btn-outline"
                    disabled={!navigationInfo.previousContent}
                  >
                    {t("PREVIOUS")}
                  </Button>
                )}
              </Box>
              <Box style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {navigationInfo.nextContent && (
                  <Button
                    variant="contained"
                    onClick={() =>
                      navigateToContent(navigationInfo.nextContent.identifier)
                    }
                    className="custom-btn-primary"
                    disabled={!navigationInfo.nextContent}
                  >
                    {t("NEXT")}
                  </Button>
                )}
                {navigationInfo.nextModule && (
                  <Button
                    variant="contained"
                    onClick={() =>
                      navigateToContent(navigationInfo.nextModule.firstContentId)
                    }
                    className="custom-btn-primary"
                    disabled={!navigationInfo.nextModule}
                  >
                    {t("NEXT_MODULE")}
                  </Button>
                )}
              </Box>
            </Box>
          )}
          
          <Box
            style={{
              paddingBottom: "2%",
              marginTop: "2%",
            }}
          >
            {isLearnathon && learnathonDetails?.status === "Live" && (
              <div className="vote-section">
                <Button
                  type="button"
                  className="custom-btn-primary ml-20"
                  onClick={() => handleClick(pollId)}
                  disabled={alreadyVoted} // Disable button if alreadyVoted is true
                >
                  {t("VOTE_FOR_THIS_CONTENT")}
                </Button>

                {/* Conditionally render the message if alreadyVoted is true */}
                {alreadyVoted && (
                  <Typography variant="body1" color="error" className="ml-20">
                    {t("You have already voted")}
                  </Typography>
                )}
              </div>
            )}
            {reviewEnable && !isPublished && (
              <div className="vote-section">
                <Button
                  type="button"
                  className="custom-btn-primary ml-20"
                  onClick={() => Publish()}
                  disabled={isPublished}
                >
                  {t("PUBLISH")}
                </Button>
                <Button
                  type="button"
                  className="custom-btn-danger ml-20"
                  onClick={() => Reject()}
                  disabled={isPublished}
                >
                  {t("REJECT")}
                </Button>
              </div>
            )}
            <Accordion defaultExpanded>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel1-content"
                id="panel1-header"
              >
                <Typography fontWeight={"700"}>{t("DESCRIPTION")}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>
                  {isLearnathon
                    ? learnathonDetails?.description
                    : lesson?.description}
                </Typography>
                {isLearnathon && (
                  <div>
                    <AccordionSummary
                      aria-controls="panel1-content"
                      id="panel1-header"
                    >
                      <Typography marginLeft={"-22px"} fontWeight={"700"}>
                        {t("CATEGORY_OF_PARTICIPATION")}
                      </Typography>
                    </AccordionSummary>
                    <Typography marginLeft={"0px"}>
                      {learnathonDetails?.category_of_participation}
                    </Typography>
                    <AccordionSummary
                      aria-controls="panel1-content"
                      id="panel1-header"
                    >
                      <Typography marginLeft={"-22px"} fontWeight={"700"}>
                        {t("NAME_OF_ORGANISATION")}
                      </Typography>
                    </AccordionSummary>
                    <Typography marginLeft={"0px"}>
                      {learnathonDetails?.name_of_organisation}
                    </Typography>
                    <AccordionSummary
                      aria-controls="panel1-content"
                      id="panel1-header"
                    >
                      <Typography marginLeft={"-22px"} fontWeight={"700"}>
                        {t("NAME_OF_DEPARTMENT_GROUP")}
                      </Typography>
                    </AccordionSummary>
                    <Typography marginLeft={"0px"}>
                      {learnathonDetails?.name_of_department_group}
                    </Typography>
                    <AccordionSummary
                      aria-controls="panel1-content"
                      id="panel1-header"
                    >
                      <Typography marginLeft={"-22px"} fontWeight={"700"}>
                        {t("INDICATIVE_THEME")}
                      </Typography>
                    </AccordionSummary>
                    <Typography marginLeft={"0px"}>
                      {learnathonDetails?.indicative_theme}
                    </Typography>
                  </div>
                )}
              </AccordionDetails>
            </Accordion>
            {!isLearnathon && (
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="panel2-content"
                  id="panel2-header"
                >
                  <Typography>{t("ABOUTTHECONTENT")}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {lesson?.attributions && (
                    <>
                      <Box sx={{ fontWeight: "bold" }}>{t("ATTRIBUTIONS")}</Box>
                      <Box>{lesson?.attributions.join(", ")}</Box>
                    </>
                  )}
                  <Box sx={{ fontWeight: "bold" }}>
                    {t("LICENSEDETAILS")} :{" "}
                  </Box>
                  {lesson?.licenseDetails && (
                    <Typography className="mb-10">
                      <Box>
                        {lesson?.licenseDetails.name} -{" "}
                        {lesson?.licenseDetails.description}
                      </Box>
                      <Box className="url-class">
                        <a
                          href={lesson?.licenseDetails.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {lesson?.licenseDetails.url}
                        </a>
                      </Box>
                    </Typography>
                  )}

                  <Typography className="mb-10">
                    <Box sx={{ fontWeight: "bold" }}>{t("COPYRIGHT")} :</Box>
                    <Box>{lesson?.copyright}</Box>
                  </Typography>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
          <Box></Box>
        </Container>
        {openFeedBack && (
          <FeedbackPopup
            open={openFeedBack}
            onClose={handleClose}
            className="feedback-popup"
            contentId={contentId}
          />
        )}
        <FloatingChatIcon />
      </Box>
      <Footer />
    </div>
  );
};

export default Player;